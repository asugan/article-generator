'use client';

import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { articleAPI } from '../services/api';
import type { ClientArticleMetadata } from '../lib/clientStorage';
import type { SelectedTextParaphraseResponse } from '../services/api';

interface ArticleEditorProps {
  article: ClientArticleMetadata;
  onSave: (updates: { content?: string; title?: string; metaDescription?: string }) => Promise<void>;
  saving: boolean;
}

const ArticleEditor: React.FC<ArticleEditorProps> = ({ article, onSave, saving }) => {
  const [title, setTitle] = useState(article.title);
  const [content, setContent] = useState(article.content);
  const [metaDescription, setMetaDescription] = useState(article.metaDescription);
  const [selectedText, setSelectedText] = useState('');
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [showParaphraseModal, setShowParaphraseModal] = useState(false);
  const [paraphraseOptions, setParaphraseOptions] = useState<string[]>([]);
  const [paraphrasing, setParaphrasing] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const contentRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  // Değişiklikleri izle
  useEffect(() => {
    const changed = title !== article.title || content !== article.content || metaDescription !== article.metaDescription;
    setHasChanges(changed);
  }, [title, content, metaDescription, article]);

  // Metin seçimi işlemleri
  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      setSelectedText(selection.toString().trim());
    }
  };

  // Sağ tık menüsü
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (selectedText.trim().length > 0) {
      setContextMenuPosition({ x: e.clientX, y: e.clientY });
      setShowContextMenu(true);
    }
  };

  // Context menu'yu kapat
  const closeContextMenu = () => {
    setShowContextMenu(false);
  };

  // Paraphrase modal'ını kapat
  const closeParaphraseModal = () => {
    setShowParaphraseModal(false);
    setParaphraseOptions([]);
  };

  // Seçili metni paraphrase et
  const handleParaphrase = async () => {
    if (!selectedText.trim()) return;

    try {
      setParaphrasing(true);
      closeContextMenu();

      const response: SelectedTextParaphraseResponse = await articleAPI.paraphraseSelectedText({
        text: selectedText,
        adequacy: 1.2,
        fluency: 1.5,
        diversity: 1.0,
        max_variations: 3
      });

      setParaphraseOptions(response.paraphrased_variations);
      setShowParaphraseModal(true);
    } catch (error) {
      console.error('Paraphrase error:', error);
      alert('Failed to paraphrase text. Please try again.');
    } finally {
      setParaphrasing(false);
    }
  };

  // Paraphrase seçeneğini uygula
  const applyParaphrase = (paraphrasedText: string) => {
    if (!contentRef.current) return;

    const textarea = contentRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    // Seçili metni paraphrase edilmiş metin ile değiştir
    const newContent = content.substring(0, start) + paraphrasedText + content.substring(end);
    setContent(newContent);

    // Cursor'u değiştirilen metnin sonuna yerleştir
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + paraphrasedText.length, start + paraphrasedText.length);
    }, 0);

    closeParaphraseModal();
  };

  // Kaydet
  const handleSave = async () => {
    await onSave({
      title: title !== article.title ? title : undefined,
      content: content !== article.content ? content : undefined,
      metaDescription: metaDescription !== article.metaDescription ? metaDescription : undefined
    });
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + S ile kaydet
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (hasChanges && !saving) {
          handleSave();
        }
      }

      // Escape ile menüleri kapat
      if (e.key === 'Escape') {
        closeContextMenu();
        closeParaphraseModal();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [hasChanges, saving]);

  // Dışarı tıklandığında menüleri kapat
  useEffect(() => {
    const handleClickOutside = () => {
      closeContextMenu();
    };

    if (showContextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showContextMenu]);

  return (
    <div className="bg-white rounded-lg shadow-lg">
      {/* Toolbar */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex justify-between items-center">
          <div className="flex space-x-2">
            <button
              onClick={() => setPreviewMode(false)}
              className={`px-4 py-2 text-sm font-medium rounded ${
                !previewMode
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Edit
            </button>
            <button
              onClick={() => setPreviewMode(true)}
              className={`px-4 py-2 text-sm font-medium rounded ${
                previewMode
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Preview
            </button>
          </div>

          <div className="flex items-center space-x-2">
            {hasChanges && (
              <span className="text-sm text-orange-600 font-medium">Unsaved changes</span>
            )}
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className="px-6 py-2 bg-green-600 text-white font-medium rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save (Ctrl+S)'}
            </button>
          </div>
        </div>
      </div>

      {/* Editor Content */}
      <div className="p-6">
        {/* Title Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Article Title
          </label>
          <input
            ref={titleRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter article title"
          />
        </div>

        {/* Meta Description */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Meta Description
          </label>
          <textarea
            value={metaDescription}
            onChange={(e) => setMetaDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter meta description for SEO"
          />
        </div>

        {/* Content Editor */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Article Content {previewMode ? '(Preview)' : '(Select text and right-click to paraphrase)'}
          </label>

          {!previewMode ? (
            <div className="relative">
              <textarea
                ref={contentRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onSelect={handleTextSelection}
                onMouseUp={handleTextSelection}
                onContextMenu={handleContextMenu}
                className="w-full h-96 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Write your article content here... Select any text and right-click to paraphrase."
              />

              {/* Word count */}
              <div className="absolute bottom-2 right-2 text-xs text-gray-500">
                {content.split(/\s+/).filter(word => word.length > 0).length} words
              </div>
            </div>
          ) : (
            <div className="border border-gray-300 rounded-md p-4 h-96 overflow-y-auto text-black">
              <div className="prose max-w-none text-black">
                <ReactMarkdown>{content}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>

        {/* Instructions */}
        {!previewMode && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <h4 className="font-medium text-blue-800 mb-2">Editing Tips:</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Select any text and right-click to paraphrase with AI</li>
              <li>• Press Ctrl+S to save your changes</li>
              <li>• Switch to Preview mode to see how your article will look</li>
              <li>• Changes are automatically tracked</li>
            </ul>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {showContextMenu && (
        <div
          className="fixed bg-white border border-gray-200 rounded-lg shadow-lg py-2 z-50"
          style={{ left: contextMenuPosition.x, top: contextMenuPosition.y }}
        >
          <button
            onClick={handleParaphrase}
            disabled={paraphrasing}
            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            {paraphrasing ? 'Paraphrasing...' : '🔄 Paraphrase Selected Text'}
          </button>
          <div className="border-t border-gray-200 my-1"></div>
          <button
            onClick={closeContextMenu}
            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Paraphrase Modal */}
      {showParaphraseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">
                  Choose Paraphrase Option
                </h3>
                <button
                  onClick={closeParaphraseModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">Original text:</p>
                <div className="bg-gray-50 p-3 rounded text-sm text-black">
                  &quot;{selectedText}&quot;
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-black">Paraphrased options:</p>
                {paraphraseOptions.map((option, index) => (
                  <div
                    key={index}
                    className="border border-gray-200 rounded-lg p-3 hover:border-blue-300 cursor-pointer transition-colors text-black"
                    onClick={() => applyParaphrase(option)}
                  >
                    <p className="text-sm text-black">{option}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex justify-end space-x-2">
                <button
                  onClick={closeParaphraseModal}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArticleEditor;