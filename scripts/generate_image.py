#!/usr/bin/env python3
"""
Booty & Bounties — AI image generation via Google Gemini
Usage:
  python scripts/generate_image.py "prompt" "./output.png"
  python scripts/generate_image.py "prompt"          # saves to ./generated.png

Requires:
  GEMINI_API_KEY env var  (or pass --key <key>)
"""
import sys
import os
import json
import base64
import urllib.request
import urllib.error
import argparse


MODEL = "gemini-3-pro-image-preview"
API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"


def generate_image(prompt: str, output_path: str, api_key: str) -> str:
    url = f"{API_BASE}/{MODEL}:generateContent?key={api_key}"

    payload = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseModalities": ["image", "text"]},
    }).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {e.code}: {body}") from e

    # Find the image part in the response
    candidates = data.get("candidates", [])
    if not candidates:
        raise RuntimeError(f"No candidates returned.\nFull response: {json.dumps(data, indent=2)}")

    for candidate in candidates:
        for part in candidate.get("content", {}).get("parts", []):
            if "inlineData" in part:
                mime = part["inlineData"].get("mimeType", "image/png")
                image_b64 = part["inlineData"]["data"]
                image_bytes = base64.b64decode(image_b64)

                # Ensure parent directory exists
                os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

                with open(output_path, "wb") as f:
                    f.write(image_bytes)

                print(f"✓  Saved ({mime}): {output_path}  [{len(image_bytes):,} bytes]")
                return output_path

    raise RuntimeError(
        f"No image found in response parts.\nFull response: {json.dumps(data, indent=2)}"
    )


def main():
    parser = argparse.ArgumentParser(description="Generate an image via Google Gemini")
    parser.add_argument("prompt", help="Prompt describing the image to generate")
    parser.add_argument("output", nargs="?", default="./generated.png",
                        help="Output file path (default: ./generated.png)")
    parser.add_argument("--key", help="Gemini API key (overrides GEMINI_API_KEY env var)")
    args = parser.parse_args()

    api_key = args.key or os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        print("ERROR: GEMINI_API_KEY env var not set and --key not provided.", file=sys.stderr)
        sys.exit(1)

    print(f"Generating: {args.prompt!r}")
    print(f"Output:     {args.output}")
    generate_image(args.prompt, args.output, api_key)


if __name__ == "__main__":
    main()
