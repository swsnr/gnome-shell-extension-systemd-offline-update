// Copyright Sebastian Wiesner <sebastian@swsnr.de>
//
// Licensed under the EUPL
//
// See https://interoperable-europe.ec.europa.eu/collection/eupl/eupl-text-eupl-12

import GObject from "gi://GObject";
import GLib from "gi://GLib";
import Gio from "gi://Gio";
import St from "gi://St";

import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";

import {
  ConsoleLike,
  Extension,
} from "resource:///org/gnome/shell/extensions/extension.js";

Gio._promisify(Gio.File.prototype, "query_info_async");

/**
 * A destructible thing.
 */
interface Destructible {
  destroy(): void;
}

/**
 * A destroyer of things.
 *
 * Tracks destructible objects and destroys them all when it itself is destroyed.
 */
class Destroyer {
  #logger: ConsoleLike;

  /**
   * Create a new destroyer.
   */
  constructor(logger: ConsoleLike) {
    this.#logger = logger;
  }

  /**
   * Registered destructibles.
   */
  #destructibles: Destructible[] = [];

  /**
   * Track a destructible object.
   *
   * The object is destroyed when this destroyer gets destroyed.
   *
   * If `destructible` is a GObject binding automatically create a destructible
   * which unbinds the binding.
   *
   * @param destructible The object to track
   * @returns `destructible`
   */
  add<T extends Destructible | GObject.Binding>(destructible: T): T {
    if (destructible instanceof GObject.Binding) {
      this.#destructibles.push({
        destroy() {
          destructible.unbind();
        },
      });
    } else {
      this.#destructibles.push(destructible);
    }
    return destructible;
  }

  /**
   * Destroy all tracked destructible objects.
   */
  destroy() {
    let destructible = undefined;
    while ((destructible = this.#destructibles.pop())) {
      try {
        destructible.destroy();
      } catch (error) {
        this.#logger.error("Failed to destroy object", destructible, error);
      }
    }
  }
}

/**
 * Load icons from a directory following the icon theme specificion.
 */
class IconThemeLoader {
  /**
   * The theme to lookup our icons.
   */
  #theme = St.IconTheme.new();

  /**
   * Create a new icon loader.
   *
   * @param iconDirectory The directory icons are contained in.
   */
  constructor(iconDirectory: Gio.File) {
    const iconPath = iconDirectory.get_path();
    if (iconPath === null) {
      throw new Error("Failed to get path of icon directory");
    }
    this.#theme.append_search_path(iconPath);
  }

  /**
   * Lookup an icon by name.
   *
   * @param name The name of the icon
   * @returns The icon
   */
  lookupIcon(name: string): Gio.Icon {
    // We only include SVG icons currently, so we can just specify any size and
    // ignore the scale.  We force SVG to be on the safe side.
    const icon = this.#theme.lookup_icon(
      name,
      16,
      St.IconLookupFlags.FORCE_SVG,
    );
    if (icon === null) {
      throw new Error(`Icon ${name} not found`);
    }
    const iconFilename = icon.get_filename();
    if (iconFilename === null) {
      throw new Error(`Icon ${name} had no file`);
    }
    return Gio.FileIcon.new(Gio.File.new_for_path(iconFilename));
  }
}

/**
 * The name of the file indicating a pending offline update.
 */
const UPDATE_FILENAME = "system-update";

/**
 * Directories in which the update file is created.
 */
const UPDATE_FILE_DIRECTORIES = ["/", "/etc"].map((d) =>
  Gio.File.new_for_path(d),
);

/**
 * Asynchronously check whether a file exists.
 *
 * @param file The file to check
 */
const fileExists = async (file: Gio.File): Promise<boolean> => {
  try {
    await file.query_info_async(
      Gio.FILE_ATTRIBUTE_STANDARD_TYPE,
      // We care for the file itself not its symlink target
      Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS,
      GLib.PRIORITY_DEFAULT,
      null,
    );
    return true;
  } catch (error) {
    if (
      error instanceof GLib.Error &&
      error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND)
    ) {
      return false;
    }
    throw error;
  }
};

const UpdateMonitor = GObject.registerClass(
  {
    Properties: {
      "offline-update-pending": GObject.ParamSpec.boolean(
        "offline-update-pending",
        null,
        null,
        GObject.ParamFlags.READABLE,
        false,
      ),
    },
  },
  /**
   * Monitor for pending system updates.
   *
   * @implements Destructible
   */
  class UpdateMonitor extends GObject.Object {
    _offlineUpdatePending = false;

    _monitors: [Gio.FileMonitor, number][] = [];

    _log: ConsoleLike;

    /**
     * Create a new monitor.
     *
     * @param log The logger to use
     */
    constructor(log: ConsoleLike) {
      super();

      this._log = log;

      for (const directory of UPDATE_FILE_DIRECTORIES) {
        log.debug("Monitoring", directory.get_uri());
        const monitor = directory.monitor(Gio.FileMonitorFlags.NONE, null);
        const handlerId = monitor.connect(
          "changed",
          (_monitor, file, _otherFile, eventType) => {
            log.debug("Changed", file.get_uri(), eventType);
            const events = [
              Gio.FileMonitorEvent.CREATED,
              Gio.FileMonitorEvent.DELETED,
            ];
            if (
              file.get_basename() === UPDATE_FILENAME &&
              events.includes(eventType)
            ) {
              this.checkPendingUpdate();
            }
          },
        );
        this._monitors.push([monitor, handlerId]);
      }

      this.checkPendingUpdate();
    }

    destroy() {
      for (const [monitor, handlerId] of this._monitors) {
        monitor.disconnect(handlerId);
        monitor.cancel();
      }
      this._monitors = [];
    }

    checkPendingUpdate() {
      Promise.all(
        UPDATE_FILE_DIRECTORIES.map((d) =>
          fileExists(d.get_child(UPDATE_FILENAME)),
        ),
      )
        .then((e) => {
          this._offlineUpdatePending = e.some((e) => e);
          this._log.log(
            "Systemd offline update pending?",
            this._offlineUpdatePending,
          );
          this.notify("offline-update-pending");
        })
        .catch((error) => {
          this._log.error("Failed to update indicator:", error);
        });
    }

    /**
     * Whether an offline update is pending
     */
    get offline_update_pending() {
      return this._offlineUpdatePending;
    }
  },
);

const UpdateIndicator = GObject.registerClass(
  /**
   * An indicator for pending updates.
   */
  class UpdateIndicator extends PanelMenu.Button implements Destructible {
    /**
     * Create a new indicator for pending updates.
     *
     * @param iconLoader Load icons.
     */
    constructor(iconLoader: IconThemeLoader) {
      super(0, "Systemd Offline Update", true);

      this.add_child(
        new St.Icon({
          styleClass: "system-status-icon",
          gicon: iconLoader.lookupIcon("up-arrow-in-a-star-symbolic"),
        }),
      );

      this.setSensitive(false);
    }
  },
);

/**
 * Extension to indicate pending systemd offline updates.
 *
 * Show a small GNOME Shell indicator if there are pending systemd offline updates.
 */
export default class SystemdOfflineUpdateExtension extends Extension {
  /**
   * Destructible for the enabled extension, or null if the extension is not enabled.
   */
  #enabledExtension: Destructible | null = null;

  /**
   * The version of this extension, as extracted from metadata.
   */
  get version(): string {
    return this.metadata["version-name"] ?? "n/a";
  }

  /**
   * Initialize this extension.
   *
   * Create the indicator and add it to the status area.
   *
   * @param destroyer Tor egister cleanup actions on.
   */
  #initialize(destroyer: Destroyer) {
    const log = this.getLogger();
    const iconLoader = new IconThemeLoader(
      this.metadata.dir.get_child("icons"),
    );

    log.log("Creating indicator for pending offline update");
    const indicator = destroyer.add(new UpdateIndicator(iconLoader));

    log.log("Monitoring for pending offline update");
    const monitor = destroyer.add(new UpdateMonitor(log));
    destroyer.add(
      monitor.bind_property(
        "offline-update-pending",
        indicator,
        "visible",
        GObject.BindingFlags.SYNC_CREATE,
      ),
    );

    Main.panel.addToStatusArea(this.metadata.uuid, indicator);
  }

  /**
   * Enable this extension.
   *
   * If not already enabled, call `initialize` and keep track its allocated resources.
   */
  override enable() {
    const log = this.getLogger();
    if (!this.#enabledExtension) {
      log.log(`Enabling extension ${this.metadata.uuid} ${this.version}`);
      const destroyer = new Destroyer(log);
      try {
        this.#initialize(destroyer);
      } catch (error) {
        destroyer.destroy();
        throw error;
      }

      this.#enabledExtension = destroyer;
      log.log(
        `Extension ${this.metadata.uuid} ${this.version} successfully enabled`,
      );
    }
  }

  /**
   * Disable this extension.
   *
   * If existing, destroy the allocated resources of `initialize`.
   *
   * @override
   */
  override disable() {
    this.getLogger().log(
      `Disabling extension ${this.metadata.uuid} ${this.version}`,
    );
    this.#enabledExtension?.destroy();
    this.#enabledExtension = null;
  }
}
