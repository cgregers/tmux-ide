# Branded alpha packaging

Uses the existing docs/app/icon.png artwork; ICNS provenance is in assets/app-icon-source.json. Assembler copies the icon, names it in Info.plist and records its hash. Package checks verify exact asset bytes and metadata. Four focused metadata/icon tests pass. A fresh explicit-metadata 0.1.0 build 2026101301 passed all 10 package artifact/compatibility checks with zero skips. No native Rust code changed or rebuilt.

Unsigned ZIP prepared locally for Apple Silicon/macOS14.2+, not publicly released or signed. Developer ID identity is unavailable on this Mac; signing/notarization and clean-machine qualification remain open. Existing running previews and production sessions untouched.
