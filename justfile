tsc := 'npx tsc'

default:
    just --list

typecheck:
    npx tsc --project .

lint:
    npx eslint .
    npx prettier --check .
    npm audit

test-all: && typecheck lint
    npm ci

# Format all files
format:
    npx prettier --write .

# Remove build outputs
clean:
    rm -rf build systemd-offline-update@swsnr.de.shell-extension.zip*

# Build the extension
build:
    {{tsc}} --project ./tsconfig.pack.json
    cp -t build metadata.json

# Pack the extension into GNOME extension ZIP file for installation.
pack: clean build
    gnome-extensions pack --force \
        --extra-source ../icons --extra-source ../LICENSE --extra-source lib \
        build

# Sign the packed extension with my SSH key.
sign: pack
    # Get my codeberg SSH key for signing the artifacts
    curl https://codeberg.org/swsnr.keys > key
    ssh-keygen -Y sign -f key -n file systemd-offline-update@swsnr.de.shell-extension.zip
    @rm -f key

_ensure-repo-clean:
    git update-index --really-refresh
    git diff-index --quiet HEAD

# Release as the given `VERSION`.
release VERSION: _ensure-repo-clean
    sed -i 's/"version-name": .*,/"version-name": "{{VERSION}}",/' metadata.json
    git add metadata.json
    git commit -m 'Release {{VERSION}}'
    git tag -a -s 'v{{VERSION}}'
    just pack sign
    echo "Upload zip to https://extensions.gnome.org"
    echo "Push and create a new codeberg release at https://codeberg.org/swsnr/gnome-shell-extension-systemd-offline-update/releases/new?tag=v{{VERSION}}"

# Install the extension for this user
install-user: pack
    gnome-extensions install --force systemd-offline-update@swsnr.de.shell-extension.zip

# Run a nested wayland session to test this extension
run-nested: install-user
    dbus-run-session -- gnome-shell --nested --wayland
