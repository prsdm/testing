# Kimiro sandbox executor v1 — Python + Node + office tooling for skill scripts.
FROM docker.io/library/node:24-trixie-slim AS node_source

FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV NODE_PATH=/usr/local/lib/node_modules
ENV SANDBOX_SESSIONS_ROOT=/workspace/sessions
ENV PORT=8089

RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    coreutils \
    curl \
    fontconfig \
    fonts-crosextra-caladea \
    fonts-crosextra-carlito \
    fonts-dejavu-core \
    fonts-liberation \
    libreoffice-core \
    libreoffice-calc \
    libreoffice-impress \
    libreoffice-writer \
    pandoc \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

COPY --from=node_source /usr/local/bin/node /usr/local/bin/node
COPY --from=node_source /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -sf ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
  && ln -sf ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx

RUN pip install --no-cache-dir \
    defusedxml \
    lxml \
    matplotlib \
    markitdown \
    openpyxl \
    pandas \
    pdf2image \
    pdfplumber \
    pillow \
    pypdf \
    python-pptx \
    reportlab \
    requests \
  && python -c "\
import defusedxml, lxml; \
import openpyxl, pandas, markitdown; \
import pypdf, pdfplumber, pdf2image, reportlab; \
import pptx; \
from PIL import Image; \
print('python skill deps ok')"

RUN npm install -g docx@9.7.1 pptxgenjs@4.0.1 react@19 react-dom@19 react-icons@5.5.0 sharp@0.35.3 \
  && node -e "require('docx'); require('pptxgenjs'); require('sharp'); require('react'); require('react-dom'); require('react-icons/fa'); console.log('node skill deps ok');" \
  && npm cache clean --force \
  && rm -rf /root/.npm

RUN useradd -u 1000 -m -s /bin/bash sandbox \
  && mkdir -p /workspace/sessions \
  && chown -R sandbox:sandbox /workspace

WORKDIR /app
COPY path_jail.py server.py /app/
RUN chown -R sandbox:sandbox /app

USER sandbox
EXPOSE 8089
CMD ["python3", "/app/server.py"]
