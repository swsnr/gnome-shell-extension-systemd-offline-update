tsc := 'npx tsc'

uuid := 'systemd-offline-update@swsnr.de'
artifact := uuid + '.shell-extension.zip'

xgettext_opts := '--package-name=' + uuid + \
    ' --foreign-user --copyright-holder "Sebastian Wiesner <sebastian@swsnr.de>"' + \
    ' --sort-by-file --from-code=UTF-8 --add-comments'

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
    rm -rf build {{artifact}} {{artifact}}.sig

# Build the extension
build:
    {{tsc}} --project ./tsconfig.pack.json
    cp -t build metadata.json

# Extract messages for translation
pot:
    @# Extract messages from typescript sources
    find src -name '*.ts' > po/POTFILES.ts
    xgettext {{xgettext_opts}} --language=Javascript --output=po/{{uuid}}.ts.pot --files-from=po/POTFILES.ts
    @# Merge all extracted messages
    xgettext {{xgettext_opts}} --output=po/{{uuid}}.pot po/{{uuid}}.ts.pot
    @rm -f po/{{uuid}}.ts.pot po/POTFILES.ts
    @# We strip the POT-Creation-Date from the resulting POT because xgettext bumps
    @# it everytime regardless if anything else changed, and this just generates
    @# needless diffs.
    sed -i /POT-Creation-Date/d po/{{uuid}}.pot

# Pack the extension into GNOME extension ZIP file for installation.
pack: clean build
    gnome-extensions pack --force \
        --extra-source ../icons --extra-source ../LICENSE --extra-source lib \
        build

# Sign the packed extension with my SSH key.
sign: pack
    # Get my codeberg SSH key for signing the artifacts
    curl https://codeberg.org/swsnr.keys > key
    ssh-keygen -Y sign -f key -n file {{artifact}}
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
    git push --follow-tags
    @echo "Upload {{artifact}} to https://extensions.gnome.org/upload/"
    @echo "Create a new codeberg release at https://codeberg.org/swsnr/gnome-shell-extension-systemd-offline-update/releases/new?tag=v{{VERSION}}"

# Install the extension for this user
install-user: pack
    gnome-extensions install --force {{artifact}}

# Run a nested wayland session to test this extension
run-nested: install-user
    dbus-run-session -- gnome-shell --nested --wayland
