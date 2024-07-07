#!/bin/bash
#
# Edits the JSON tacked onto the end of a PNG file.
#
set -euo pipefail

log() {
    echo "=== $@" >&2
}

infile="$1"

# Die if we don't have an editor chosen
: "$EDITOR"

log "Finding JSON in input file: $infile"
n=`grep -obaF XXMAGICXX "$infile" | cut -d: -f1`

log "JSON begins at byte: $n"

jsonfile=`mktemp`
log "Extracting JSON as temporary file: $jsonfile"
tail -c +$((n + 10)) "$infile" | jq >"$jsonfile"

log "Opening JSON with editor '$EDITOR'..."
"$EDITOR" "$jsonfile"

outputfile=`mktemp`
log "Generating temporary output file, like input file but with the edited JSON: $outputfile"
( head -c $((n + 9)) "$infile"; jq -c <"$jsonfile") >"$outputfile"

log "Replacing input file with outputfile: mv $outputfile $infile"
mv "$outputfile" "$infile"
