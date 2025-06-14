// Copyright Sebastian Wiesner <sebastian@swsnr.de>
//
// Licensed under the EUPL
//
// See https://interoperable-europe.ec.europa.eu/collection/eupl/eupl-text-eupl-12

import GObject from "gi://GObject";

import { ConsoleLike } from "resource:///org/gnome/shell/extensions/extension.js";

import { OfflineUpdateBackend } from "./backend.js";

/**
 * A class to control offline updates.
 */
export const OfflineUpdateController = GObject.registerClass(
  {
    Properties: {
      "offline-update-backend":
        GObject.ParamSpec.jsobject<OfflineUpdateBackend | null>(
          "backend",
          null,
          null,
          GObject.ParamFlags.READWRITE,
        ),
    },
  },
  class OfflineUpdateController extends GObject.Object {
    _backend: OfflineUpdateBackend | null = null;

    private readonly _log: ConsoleLike;

    constructor(log: ConsoleLike) {
      super();
      this._log = log;
    }

    get backend(): OfflineUpdateBackend | null {
      return this._backend;
    }

    set backend(backend: OfflineUpdateBackend | null) {
      this._backend = backend;
    }

    async cancelPendingUpdate() {
      if (this._backend) {
        this._log.log("Cancelling pending offline update");
        await this._backend.cancel();
      } else {
        this._log.log("No backend for offline update");
      }
    }
  },
);

export type OfflineUpdateController = InstanceType<
  typeof OfflineUpdateController
>;
