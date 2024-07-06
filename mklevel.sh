#!/bin/bash
set -euo pipefail

filename="$1.png"

mv "images/$filename" levels/
