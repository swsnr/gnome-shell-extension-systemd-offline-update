# Systemd Offline Update Indicator GNOME shell extension

Show a GNOME shell indicator for pending [systemd offline updates][1], via e.g. [pacman-offline].

[1]: https://www.freedesktop.org/software/systemd/man/latest/systemd.offline-updates.html
[pacman-offline]: https://github.com/eworm-de/pacman-offline

## Install

Download the latest ZIP file from [releases](https://codeberg.org/swsnr/gnome-shell-extension-systemd-offline-update/releases),
and install with

```console
$ gnome-extensions install systemd-offline-update@swsnr.de.shell-extension.zip
```

Release artifacts are signed with my Codeberg SSH keys from <https://codeberg.org/swsnr.keys>.

Alternatively, install from [extensions.gnome.org](https://extensions.gnome.org/extension/8245/systemd-offline-update-indicator/), but note that releases on extensions.gnome.org may be delayed or outright rejected by its mandatory review process.
The author of this extension does not use extensions.gnome.org.

## License

Copyright Sebastian Wiesner <sebastian@swsnr.de>

Licensed under the EUPL, see <https://interoperable-europe.ec.europa.eu/collection/eupl/eupl-text-eupl-12>
