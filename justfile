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

ensure-repo-clean:
    git update-index --really-refresh
    git diff-index --quiet HEAD

release VERSION: ensure-repo-clean
    sed -i 's/"version-name": .*,/"version-name": "{{VERSION}}",/' metadata.json
    git add metadata.json
    git commit -m 'Release {{VERSION}}'
    git tag -a -s 'v{{VERSION}}'
    just pack
    echo "Upload zip to https://extensions.gnome.org"
    echo "Push and create a new codeberg release at https://codeberg.org/swsnr/gnome-shell-extension-systemd-offline-update/releases/new?tag=v{{VERSION}}"
