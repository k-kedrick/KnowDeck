import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export interface UploadAnchor {
  id: string;
  pos: number;
}

interface UploadAnchorPluginState {
  anchors: UploadAnchor[];
}

export const uploadAnchorPluginKey = new PluginKey<UploadAnchorPluginState>('uploadAnchor');

type UploadAnchorAction =
  | { type: 'ADD_ANCHOR'; id: string; pos: number }
  | { type: 'REMOVE_ANCHOR'; id: string };

export function addUploadAnchor(tr: any, id: string, pos: number) {
  return tr.setMeta(uploadAnchorPluginKey, { type: 'ADD_ANCHOR', id, pos } as UploadAnchorAction);
}

export function removeUploadAnchorMeta(tr: any, id: string) {
  return tr.setMeta(uploadAnchorPluginKey, { type: 'REMOVE_ANCHOR', id } as UploadAnchorAction);
}

export function getUploadAnchorPosition(state: any, id: string): number | null {
  const pluginState = uploadAnchorPluginKey.getState(state);
  if (!pluginState) return null;
  const anchor = pluginState.anchors.find((a) => a.id === id);
  if (!anchor) return null;
  // Ensure position is within current document bounds
  return Math.min(Math.max(0, anchor.pos), state.doc.content.size);
}

export const UploadAnchorExtension = Extension.create({
  name: 'uploadAnchor',

  addProseMirrorPlugins() {
    return [
      new Plugin<UploadAnchorPluginState>({
        key: uploadAnchorPluginKey,
        state: {
          init() {
            return { anchors: [] };
          },
          apply(tr, oldState) {
            let anchors = oldState.anchors;

            // 1. Map existing anchors through the transaction
            if (tr.docChanged && anchors.length > 0) {
              anchors = anchors.map((anchor) => ({
                id: anchor.id,
                pos: tr.mapping.map(anchor.pos),
              }));
            }

            // 2. Process meta actions for this plugin
            const meta = tr.getMeta(uploadAnchorPluginKey) as UploadAnchorAction | undefined;
            if (meta) {
              if (meta.type === 'ADD_ANCHOR') {
                anchors = [...anchors.filter((a) => a.id !== meta.id), { id: meta.id, pos: meta.pos }];
              } else if (meta.type === 'REMOVE_ANCHOR') {
                anchors = anchors.filter((a) => a.id !== meta.id);
              }
            }

            return { anchors };
          },
        },
      }),
    ];
  },
});
