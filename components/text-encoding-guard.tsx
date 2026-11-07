'use client';

import { useEffect } from 'react';
import { repairUtf8Mojibake } from '@/lib/repair-utf8-mojibake';

/** Browser/proxy UTF-8 fallback; leaves correctly decoded DOM untouched. */
export function TextEncodingGuard() {
  useEffect(() => {
    const attrs = ['aria-label', 'title', 'placeholder'];
    const excluded = 'script,style,noscript,code,pre,textarea,[contenteditable]';

    function repairNode(node: Node): void {
      if (node.nodeType === Node.TEXT_NODE) {
        if (!node.parentElement || node.parentElement.closest(excluded)) return;
        const original = node.nodeValue ?? '';
        const fixed = repairUtf8Mojibake(original);
        if (original !== fixed) node.nodeValue = fixed;
        return;
      }
      if (!(node instanceof Element) || node.matches(excluded)) return;
      if (!node.closest(excluded)) {
        for (const key of attrs) {
          const text = node.getAttribute(key);
          if (text === null) continue;
          const repaired = repairUtf8Mojibake(text);
          if (repaired !== text) node.setAttribute(key, repaired);
        }
      }
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
      let entry: Node | null;
      while ((entry = walker.nextNode())) {
        if (entry.nodeType === Node.TEXT_NODE) repairNode(entry);
        else if (entry instanceof Element && !entry.closest(excluded)) {
          for (const key of attrs) {
            const text = entry.getAttribute(key);
            if (text === null) continue;
            const repaired = repairUtf8Mojibake(text);
            if (repaired !== text) entry.setAttribute(key, repaired);
          }
        }
      }
    }

    repairNode(document.body);
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === 'characterData' || record.type === 'attributes') {
          repairNode(record.target);
        } else {
          record.addedNodes.forEach(repairNode);
        }
      }
    });
    observer.observe(document.body, {
      subtree: true, childList: true, characterData: true,
      attributes: true, attributeFilter: attrs,
    });
    return () => observer.disconnect();
  }, []);
  return null;
}
