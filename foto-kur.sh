#!/bin/bash
set -e
cd ~
rm -rf mz
git clone -q -b firebase-yayin --depth 1 https://github.com/demirciege349/mars-zeka mz
python3 mz/fotolar.py indir
bash mz/yayinla.sh
python3 mz/fotolar.py
