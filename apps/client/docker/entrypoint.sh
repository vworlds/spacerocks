#!/bin/sh
set -eu

vars_file="${SPACEROCKS_VARS_FILE:-/usr/share/nginx/html/vars.js}"

if [ ! -f "$vars_file" ]; then
  echo "Missing $vars_file; cannot apply spacerocks connection overrides" >&2
  exit 1
fi

has_overrides=false

append_header() {
  if [ "$has_overrides" = false ]; then
    printf '\n// Runtime spacerocks connection overrides.\n' >> "$vars_file"
    has_overrides=true
  fi
}

append_number_override() {
  name="$1"
  value="$2"

  if [ -z "$value" ]; then
    return 0
  fi

  case "$value" in
    *[!0-9]*)
      echo "$name must be a number" >&2
      exit 1
      ;;
  esac

  append_header
  printf 'window.spacerocksConnectionOptions.%s=%s;\n' "$name" "$value" >> "$vars_file"
}

append_string_override() {
  name="$1"
  value="$2"

  if [ -z "$value" ]; then
    return 0
  fi

  escaped_value=$(printf '%s' "$value" | sed 's/\\/\\\\/g; s/"/\\"/g')

  append_header
  printf 'window.spacerocksConnectionOptions.%s="%s";\n' "$name" "$escaped_value" >> "$vars_file"
}

append_string_override host "${SPACEROCKS_HOST:-}"
append_number_override port "${SPACEROCKS_PORT:-}"
append_string_override protocol "${SPACEROCKS_PROTOCOL:-}"
append_string_override worldName "${SPACEROCKS_WORLD_NAME:-}"
append_string_override apiBasePath "${SPACEROCKS_API_BASE_PATH:-}"