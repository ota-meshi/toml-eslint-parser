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

	# The latest specs allow it.
	-skip='invalid/control/comment-del'
	-skip='invalid/control/comment-lf'
	-skip='invalid/control/comment-us'

	# Debug
	# -run 'valid/table/with-single-quotes'
)

e=0
toml-test -toml '1.1.0' ${skip[@]} ./toml-test-decode-toml1.1.js || e=1
exit $e
