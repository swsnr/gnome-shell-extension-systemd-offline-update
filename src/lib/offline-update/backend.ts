// Copyright Sebastian Wiesner <sebastian@swsnr.de>
//
// Licensed under the EUPL
//
// See https://interoperable-europe.ec.europa.eu/collection/eupl/eupl-text-eupl-12

import Gio from "gi://Gio";

/**
 * A package which is going to be updated.
 */
export interface Package {
  /**
   * The package name.
   */
  readonly name: string;

  /**
   * The old version.
   */
  readonly oldVersion: string;

  /**
   * The new version.
   */
  readonly newVersion: string;

  /**
   * Whether this package is "important", i.e. upgrading requires some attention by the user.
   */
  readonly important?: boolean;
}

export interface OfflineUpdateBackend {
  /**
   * The name of this backend, for logging and debugging.
   */
  readonly name: string;

  /**
   *
   * @param file The update file
   */
  isSupported(file: Gio.File): Promise<boolean>;

  /**
   * Cancel a pending offline update.
   */
  cancel(): Promise<void>;

  /**
   * Packages which will be updated.
   */
  packages(): Promise<Package[]>;
}
