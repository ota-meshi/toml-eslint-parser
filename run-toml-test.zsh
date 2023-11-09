#!/usr/bin/env zsh
#
# Requires toml-test from https://github.com/toml-lang/toml-test

skip=(
	# Invalid UTF-8 strings are not rejected
	-skip='invalid/encoding/bad-utf8-*'

	# Certain invalid UTF-8 codepoints are not rejected
	-skip='invalid/encoding/bad-codepoint'

	# Certain invalid newline codepoints are not rejected
	-skip='invalid/control/rawmulti-cd'
	-skip='invalid/control/multi-cr'
	-skip='invalid/control/bare-cr'
)

e=0
toml-test -int-as-float ${skip[@]} ./toml-test-decode.js || e=1
exit $e
