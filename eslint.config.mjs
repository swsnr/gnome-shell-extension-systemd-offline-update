// Copyright Sebastian Wiesner <sebastian@swsnr.de>
//
// Licensed under the EUPL
//
// See https://interoperable-europe.ec.europa.eu/collection/eupl/eupl-text-eupl-12

import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";

import tseslint from "typescript-eslint";

export default defineConfig(
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        // @ts-expect-error Missing types for nodejs
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      "no-console": "error",
      "no-restricted-globals": [
        "error",
        // Forbid gjs gettext globals, we have to use extension gettext to make
        // sure it gets messages from the right domain
        {
          name: "_",
          message:
            'Do not use global gjs gettext; use import { gettext as _ } from "resource:///org/gnome/shell/extensions/extension.js"',
        },
        {
          name: "C_",
          message:
            'Do not use global gjs gettext; use import { pgettext as C_ } from "resource:///org/gnome/shell/extensions/extension.js"',
        },
        {
          name: "N_",
          message: "Do not use N_",
        },
      ],
      // Typescript does this
      "no-undef": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    ignores: ["build/", "node_modules/", "eslint.config.mjs"],
  },
);
