#!/usr/bin/env bash
set -Eeuo pipefail

# Prépare uniquement le temps initial 0 et le controlDict du cas LH2.
# Les répertoires de résultats déjà calculés ne sont jamais modifiés.
CASE_DIR="${1:-pilot_case/PILOT-LH2-001/openfoam_wallBoiling_base}"
FORCE="${FORCE:-0}"

if [[ ! -d "$CASE_DIR" ]]; then
  echo "Erreur : cas OpenFOAM introuvable : $CASE_DIR" >&2
  exit 1
fi

ORIG="$CASE_DIR/0.orig"
ZERO="$CASE_DIR/0"
CONTROL="$CASE_DIR/system/controlDict"
ALPHA_ORIG="$ORIG/alpha.gas"
ALPHA="$ZERO/alpha.gas"

for path in "$ORIG" "$CONTROL" "$ALPHA_ORIG"; do
  [[ -e "$path" ]] || { echo "Erreur : élément manquant : $path" >&2; exit 1; }
done

if [[ ! -e "$ZERO" ]]; then
  cp -a "$ORIG" "$ZERO"
elif [[ "$FORCE" == "1" ]]; then
  # Réinitialise seulement les champs initiaux à partir de 0.orig.
  rm -rf "$ZERO"
  cp -a "$ORIG" "$ZERO"
fi

python3 - "$ALPHA" "$CONTROL" <<'PY'
from pathlib import Path
import re
import sys

alpha_path = Path(sys.argv[1])
control_path = Path(sys.argv[2])

alpha = alpha_path.read_text(encoding="utf-8")
control = control_path.read_text(encoding="utf-8")

# Remplace uniquement le champ initial du fichier alpha.gas.
alpha_new, n_alpha = re.subn(
    r"(^\s*internalField\s+uniform\s+)[^;]+(;)",
    r"\g<1>0.01\g<2>",
    alpha,
    count=1,
    flags=re.MULTILINE,
)
if n_alpha != 1:
    raise SystemExit("Erreur : internalField uniforme introuvable dans alpha.gas")

# Rend les valeurs inlet/outlet cohérentes avec l'initialisation gazeuse.
alpha_new, n_inlet = re.subn(
    r"(^\s*inletValue\s+uniform\s+)[^;]+(;)",
    r"\g<1>0.01\g<2>",
    alpha_new,
    flags=re.MULTILINE,
)
alpha_new, n_value = re.subn(
    r"(^\s*value\s+uniform\s+)[^;]+(;)",
    r"\g<1>0.01\g<2>",
    alpha_new,
    flags=re.MULTILINE,
)
if n_inlet < 1 or n_value < 1:
    raise SystemExit("Erreur : valeurs limites attendues absentes dans alpha.gas")

control_new, n_co = re.subn(
    r"(^\s*maxCo\s+)[^;]+(;)",
    r"\g<1>0.02\g<2>",
    control,
    count=1,
    flags=re.MULTILINE,
)
if n_co != 1:
    raise SystemExit("Erreur : entrée maxCo introuvable dans system/controlDict")

alpha_path.write_text(alpha_new, encoding="utf-8")
control_path.write_text(control_new, encoding="utf-8")
PY

printf 'Configuration appliquée dans : %s\n' "$CASE_DIR"
grep -nE '^internalField|^\s*(inletValue|value)\s+uniform' "$ALPHA"
grep -nE '^maxCo' "$CONTROL"
printf '\nContrôle : les temps déjà calculés ne sont pas modifiés.\n'
