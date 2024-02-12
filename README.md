# 🔍 Copilot for Obsidian

This is a hardfork from https://github.com/logancyang/obsidian-copilot

I will try to merge from upstream to a certain extent for a while, but their codestyle is atrocious and unmaintainable. <br>
Previous owner doesn't seem to care about the features I need and [refuses](https://github.com/logancyang/obsidian-copilot/issues/208#issuecomment-1889777109) to collaborate giving obscure reasons.

Also the original repo is basically malware, automatically indexing the vault (although using cheap embeddings)
and [not being frugal](https://github.com/logancyang/obsidian-copilot/blob/848d2974348c9de955b52aadc1d3fbb9ab8cb6de/src/utils.ts#L138) to LLM calls in general. 

This is not acceptable for any OSS, thus the necessity for a hardfork.

# Main differences for now:

- Supports actual chat with prompt by stuffing the prompt into
