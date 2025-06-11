default:
    just --list

test-all:
    npm ci
    npm audit
    npx tsc --project .
    npx eslint .
    npx prettier --check .

pack:
    rm -f systemd-offline-update@swsnr.de.shell-extension.zip systemd-offline-update@swsnr.de.shell-extension.zip.sig
    gnome-extensions pack --force --extra-source icons --extra-source LICENSE
    # Get my codeberg SSH key for signing the artifacts
    curl https://codeberg.org/swsnr.keys > key
    ssh-keygen -Y sign -f key -n file systemd-offline-update@swsnr.de.shell-extension.zip
    @rm -f key
