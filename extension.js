// Copyright Sebastian Wiesner <sebastian@swsnr.de>
//
// Licensed under the EUPL
//
// See https://interoperable-europe.ec.europa.eu/collection/eupl/eupl-text-eupl-12

// @ts-check

/// <reference path="gnome-shell.d.ts" />

import GObject from "gi://GObject";
import GLib from "gi://GLib";
import Gio from "gi://Gio";
import St from "gi://St";

import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";

import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";

/**
 * @import {ConsoleLike} from "resource:///org/gnome/shell/extensions/extension.js"
 */

Gio._promisify(Gio.File.prototype, "query_info_async");

/**
 * A destroyer of things.
 *
 * Tracks destructible objects and destroys them all when it itself is destroyed.
 *
 * @typedef {{destroy: () => void}} Destructible
 */
class Destroyer {
  /**
   * @type {ConsoleLike}
   */
  #logger;

  /**
   * Create a new destroyer.
   *
   * @param {ConsoleLike} logger
   */
  constructor(logger) {
    this.#logger = logger;
  }

  /**
   * Registered destructibles.
   *
   * @type {Destructible[]}
   */
  #destructibles = [];

  /**
   * Track a destructible object.
   *
   * The object is destroyed when this destroyer gets destroyed.
   *
   * @template {Destructible} T Type of object to destroy
   * @param {T} destructible The object to track
   * @returns {T} `destructible`
   */
  add(destructible) {
    this.#destructibles.push(destructible);
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
   *
   * @type {St.IconTheme}
   */
  #theme = St.IconTheme.new();

  /**
   * Create a new icon loader.
   *
   * @param {Gio.File} iconDirectory The directory icons are contained in.
   */
  constructor(iconDirectory) {
    const iconPath = iconDirectory.get_path();
    if (iconPath === null) {
      throw new Error("Failed to get path of icon directory");
    }
    this.#theme.append_search_path(iconPath);
  }

  /**
   * Lookup an icon by name.
   *
   * @param {string} name The name of the icon
   * @returns {Gio.Icon} The icon
   */
  lookupIcon(name) {
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
 * Asynchronously check whether a file exists.
 *
 * @param {Gio.File} file The file to check
 */
const fileExists = async (file) => {
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

const UpdateIndicator = GObject.registerClass(
  /**
   * An indicator for pending updates.
   *
   * @implements Destructible
   */
  class UpdateIndicator extends PanelMenu.Button {
    /**
     * Create a new indicator for pending updates.
     *
     * @param {IconThemeLoader} iconLoader Load icons.
     */
    constructor(iconLoader) {
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
 * Extension to indicate pending systemd offline updates.
 *
 * Show a small GNOME Shell indicator if there are pending systemd offline updates.
 */
export default class SystemdOfflineUpdateExtension extends Extension {
  /**
   * Destructible for the enabled extension, or null if the extension is not enabled.
   *
   * @type {Destructible | null}
   */
  #enabledExtension = null;

  /**
   * The version of this extension, as extracted from metadata.
   *
   * @type {string}
   */
  get version() {
    return this.metadata["version-name"] ?? "n/a";
  }

  /**
   * Update the indicator according to whether updates exist.
   *
   * @param {InstanceType<UpdateIndicator>} indicator The indicator
   */
  #updateIndicator(indicator) {
    const log = this.getLogger();
    Promise.all(
      UPDATE_FILE_DIRECTORIES.map((d) =>
        fileExists(d.get_child(UPDATE_FILENAME)),
      ),
    )
      .then((e) => {
        const updatePending = e.some((e) => e);
        log.log("Systemd offline update pending?", updatePending);
        indicator.visible = updatePending;
      })
      .catch((error) => {
        log.error("Failed to update indicator:", error);
      });
  }

  /**
   * Initialize this extension.
   *
   * Create the indicator and add it to the status area.
   *
   * @param {Destroyer} destroyer Tor egister cleanup actions on.
   */
  #initialize(destroyer) {
    const log = this.getLogger();

    const iconLoader = new IconThemeLoader(
      this.metadata.dir.get_child("icons"),
    );

    const indicator = destroyer.add(new UpdateIndicator(iconLoader));
    indicator.visible = false;

    Main.panel.addToStatusArea(this.metadata.uuid, indicator);

    for (const directory of UPDATE_FILE_DIRECTORIES) {
      log.debug("Monitoring", directory.get_uri());
      const monitor = directory.monitor(Gio.FileMonitorFlags.NONE, null);
      const signalId = monitor.connect(
        "changed",
        (_monitor, file, _otherFile, eventType) => {
          log.debug("Changed", file.get_uri(), eventType);
          let events = [
            Gio.FileMonitorEvent.CREATED,
            Gio.FileMonitorEvent.DELETED,
          ];
          if (
            file.get_basename() === UPDATE_FILENAME &&
            events.includes(eventType)
          ) {
            this.#updateIndicator(indicator);
          }
        },
      );
      destroyer.add({
        destroy: () => {
          monitor.cancel();
          monitor.disconnect(signalId);
        },
      });
    }

    this.#updateIndicator(indicator);
  }

  /**
   * Enable this extension.
   *
   * If not already enabled, call `initialize` and keep track its allocated resources.
   *
   * @override
   */
  enable() {
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
  disable() {
    this.getLogger().log(
      `Disabling extension ${this.metadata.uuid} ${this.version}`,
    );
    this.#enabledExtension?.destroy();
    this.#enabledExtension = null;
  }
}
