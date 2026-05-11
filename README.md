# labelOCR

A web-based OCR labeling and dataset preparation platform built with Node.js and browser-based tools.
`labelOCR` is designed to simplify the process of creating custom OCR datasets, labeling text from images/videos, generating augmentations, and preparing training-ready OCR datasets directly from a web interface.

---

# 🚀 Features

## 🖼️ Image OCR Labeling

* Load images directly from:

  * Local uploads
  * Remote image URLs
* Draw and label OCR regions interactively
* Fast web-based annotation workflow

---

## 🎥 Video to Multi-Frame OCR Labeling

* Load videos from URLs
* Extract selectable frames from videos
* Label text independently on each frame
* Useful for:

  * CCTV OCR
  * Dashcam OCR
  * Sports overlays
  * Dynamic text datasets
  * Scene text extraction

### Preview

![Video Frame Selection](https://i.imgur.com/Y2dMbS6.png)

---

## 🔍 Tesseract.js Assisted OCR

Integrated with Tesseract.js to help accelerate labeling.

Features:

* Auto-suggest OCR text
* Human correction workflow
* Semi-automatic annotation
* Browser-based OCR assistance

---

## 📊 Character Distribution Analysis Tool

Analyze OCR dataset balance and missing characters.

Features:

* Character frequency analysis
* Missing character detection
* Dataset balancing support
* OCR coverage inspection

### Preview

![Character Distribution Tool](https://i.imgur.com/9VjiWSr.png)

---

## 🏷️ Main Labeling Interface

Interactive OCR labeling environment for images and video frames.

### Preview

![Main Labeling Interface](https://i.imgur.com/99Dg5iX.png)

---

# 📦 OCR Dataset Output Format

The generated dataset structure is training-ready for custom OCR models.

```plaintext
output/
│
├── labels.txt
├── image001.jpeg
├── image002.jpeg
├── image003.jpeg
└── ...
```

Example `labels.txt`:

```plaintext
image001.jpeg|HELLO123
image002.jpeg|ABC998
image003.jpeg|RACING01
```

---

# 🔄 Augmentation Engine

Built-in augmentation pipeline for OCR dataset generation.

Supported augmentations:

* Rotation
* Blur
* Noise
* Brightness adjustment
* Contrast adjustment
* Compression artifacts
* Perspective distortion
* Motion blur
* Scaling

Purpose:

* Improve OCR robustness
* Generate synthetic OCR samples
* Expand small datasets
* Improve custom OCR model generalization

---

# 🌐 Distributed Labeling Support

Planned architecture supports:

* JSON-based database storage
* Webhook integrations
* Distributed collaborative labeling
* Multi-user annotation
* Remote dataset synchronization

---

# 🔮 Future Roadmap

`labelOCR` is evolving toward a complete end-to-end OCR platform.

Future goals include:

## 🤖 Custom OCR Training Pipeline

* OCR dataset management
* Training orchestration
* Model evaluation
* Deployment tools

## 🧠 Custom OCR Helper Models

Support for:

* Detection models
* Text recognition models
* Auto-correction models
* AI-assisted annotation

## ☁️ Backend Support

Future backend integrations:

* Node.js API services
* Distributed processing
* Queue systems
* Cloud OCR pipelines

## 🔌 External Integrations

* JSON database systems
* Webhooks
* API integrations
* Remote training pipelines

---

# 🛠️ Installation

## Clone Repository

```bash
git clone <your_repo_url>
cd labelOCR
```

## Install Dependencies

```bash
npm install
```

or

```bash
npm i
```

---

# ▶️ Run Application

```bash
npm start
```

Then open your browser:

```plaintext
http://localhost:3000
```

---

# 🌍 Live Demo

[Live Demo - labelOCR OCRTool](https://rawcdn.githack.com/aiamirul/Fancylytics/e5e12e6ff46d816d8640af460f93c3bffb1c88ea/OCRTool/index.html?utm_source=chatgpt.com)

---

# 🧰 Tech Stack

* Node.js
* HTML5 Canvas
* JavaScript
* Tesseract.js
* Browser-based OCR tools
* Video frame extraction utilities

---

# 🎯 Use Cases

* License plate OCR
* Sports OCR
* Racing overlays
* Industrial OCR
* Receipt OCR
* Custom OCR training
* Scene text recognition
* OCR dataset generation
* Historical document transcription

---

# 📁 Planned Dataset Formats

Future export support:

* CRNN datasets
* PaddleOCR datasets
* YOLO OCR formats
* EasyOCR formats
* Transformer OCR datasets

---

# 🤝 Contributions

Contributions are welcome.

Possible areas:

* OCR models
* Augmentation engines
* Video tools
* Annotation UX
* OCR training backends
* Dataset exporters

---

# 📜 License

MIT License

---

# ⭐ Vision

`labelOCR` aims to become a complete browser-based OCR ecosystem:

* Labeling
* Dataset management
* Augmentation
* AI-assisted annotation
* OCR training
* OCR deployment
* Distributed OCR operations

All accessible directly from a modern web interface.
