#!/usr/bin/env python3
"""
Blinky 3D Desktop Companion for Linux (PySide6 / PyQt)
Creates a transparent, frameless, draggable desktop companion window on Linux.
Requirements: pip install PySide6
"""

import sys
from PySide6.QtCore import Qt, QPoint, QUrl
from PySide6.QtWidgets import QApplication, QMainWindow
from PySide6.QtWebEngineWidgets import QWebEngineView
from PySide6.QtGui import QColor

class BlinkyCompanionWindow(QMainWindow):
    def __init__(self, target_url="http://localhost:5173"):
        super().__init__()
        self.drag_position = QPoint()

        # Window Flags: Frameless, Transparent, Stays on Top
        self.setWindowFlags(
            Qt.WindowType.FramelessWindowHint |
            Qt.WindowType.WindowStaysOnTopHint |
            Qt.WindowType.SubWindow
        )
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground, True)
        self.setAttribute(Qt.WidgetAttribute.WA_NoSystemBackground, True)

        self.resize(340, 420)

        # Web view for Three.js Blinky rendering
        self.webview = QWebEngineView(self)
        self.webview.setStyleSheet("background: transparent;")
        self.webview.page().setBackgroundColor(QColor(0, 0, 0, 0))
        self.webview.load(QUrl(target_url))
        self.setCentralWidget(self.webview)

        # Position at bottom-right of primary screen
        screen = QApplication.primaryScreen().geometry()
        self.move(screen.width() - 360, screen.height() - 460)

    # Allow dragging Blinky around the Linux desktop
    def mousePressEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton:
            self.drag_position = event.globalPosition().toPoint() - self.frameGeometry().topLeft()
            event.accept()

    def mouseMoveEvent(self, event):
        if event.buttons() == Qt.MouseButton.LeftButton:
            self.move(event.globalPosition().toPoint() - self.drag_position)
            event.accept()

if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = BlinkyCompanionWindow()
    window.show()
    sys.exit(app.exec())
