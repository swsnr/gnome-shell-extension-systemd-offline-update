// Copyright Sebastian Wiesner <sebastian@swsnr.de>
//
// Licensed under the EUPL
//
// See https://interoperable-europe.ec.europa.eu/collection/eupl/eupl-text-eupl-12

import GObject from "gi://GObject";
import {
  Extension,
  type ConsoleLike,
} from "resource:///org/gnome/shell/extensions/extension.js";

/**
 * A destructible thing.
 */
export interface Destructible {
  destroy(): void;
}

/**
 * A destroyer of things.
 *
 * Tracks destructible objects and destroys them all when it itself is destroyed.
 */
export class Destroyer {
  readonly #logger: ConsoleLike;

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
 * An extension which destroys itself when disabled.
 */
export abstract class DestructibleExtension extends Extension {
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
   * @param destroyer To register cleanup actions on.
   */
  protected abstract initialize(destroyer: Destroyer): void;

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
        this.initialize(destroyer);
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
   */
  override disable() {
    this.getLogger().log(
      `Disabling extension ${this.metadata.uuid} ${this.version}`,
    );
    this.#enabledExtension?.destroy();
    this.#enabledExtension = null;
  }
}
