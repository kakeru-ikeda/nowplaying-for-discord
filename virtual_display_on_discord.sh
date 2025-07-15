#!/bin/bash
xvfb-run --auto-servernum --server-args="-screen 0 1280x720x24" \
discord --no-sandbox \
        --disable-gpu \
        --disable-dev-shm-usage \
        --in-process-gpu \
        --disable-gpu-compositing &
