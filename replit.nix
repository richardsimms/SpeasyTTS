{pkgs}: {
  deps = [
    pkgs.chromium
    pkgs.cairo
    pkgs.pango
    pkgs.cups
    pkgs.atk
    pkgs.nspr
    pkgs.nss
    pkgs.glib
    pkgs.ffmpeg
    pkgs.nodejs
    pkgs.nodePackages.typescript-language-server
    pkgs.postgresql
  ];
}
