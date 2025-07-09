<template>
  <div class="editor-wrapper">
    <div class="editor-toolbar">
      <button
        @click="editor?.chain().focus().toggleBold().run()"
        :class="{ 'is-active': editor?.isActive('bold') }"
        class="toolbar-button"
      >
        B
      </button>
      <button
        @click="editor?.chain().focus().toggleItalic().run()"
        :class="{ 'is-active': editor?.isActive('italic') }"
        class="toolbar-button"
      >
        I
      </button>
      <button
        @click="editor?.chain().focus().toggleUnderline().run()"
        :class="{ 'is-active': editor?.isActive('underline') }"
        class="toolbar-button"
      >
        U
      </button>
      <div class="toolbar-separator"></div>
      <button
        @click="editor?.chain().focus().setTextAlign('left').run()"
        :class="{ 'is-active': editor?.isActive({ textAlign: 'left' }) }"
        class="toolbar-button"
      >
        ←
      </button>
      <button
        @click="editor?.chain().focus().setTextAlign('center').run()"
        :class="{ 'is-active': editor?.isActive({ textAlign: 'center' }) }"
        class="toolbar-button"
      >
        ↔
      </button>
      <button
        @click="editor?.chain().focus().setTextAlign('right').run()"
        :class="{ 'is-active': editor?.isActive({ textAlign: 'right' }) }"
        class="toolbar-button"
      >
        →
      </button>
      <div class="toolbar-separator"></div>
      <button
        @click="editor?.chain().focus().toggleBulletList().run()"
        :class="{ 'is-active': editor?.isActive('bulletList') }"
        class="toolbar-button"
      >
        • Lista
      </button>
      <button
        @click="editor?.chain().focus().toggleOrderedList().run()"
        :class="{ 'is-active': editor?.isActive('orderedList') }"
        class="toolbar-button"
      >
        1. Lista
      </button>
      <div class="toolbar-separator"></div>
      <button
        v-if="isActorScript"
        @click="formatActorText"
        :class="{ 'is-active': false }"
        class="toolbar-button"
        title="Formatar texto do ator"
      >
        ¶
      </button>
    </div>
    <EditorContent :editor="editor" class="min-h-[150px] border rounded-md bg-white" />
  </div>
</template>

<script setup>
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import StarterKit from '@tiptap/starter-kit'
import { Editor, EditorContent } from '@tiptap/vue-3'
import { onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  isActorScript: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue'])

const editor = ref(null)

// Inicializa o editor quando o componente é montado
editor.value = new Editor({
  extensions: [
    StarterKit,
    Underline,
    TextAlign.configure({
      types: ['heading', 'paragraph']
    })
  ],
  content: props.modelValue,
  onUpdate: ({ editor }) => {
    emit('update:modelValue', editor.getHTML())
  }
})

// Atualiza o conteúdo do editor quando o v-model muda externamente
watch(() => props.modelValue, (newValue) => {
  const isSame = newValue === editor.value?.getHTML()
  if (!isSame) {
    editor.value?.commands.setContent(newValue, false)
  }
})

// Função para formatar o texto do campo de informação do ator
const formatActorText = () => {
  if (editor.value && props.isActorScript) {
    const content = editor.value.getHTML();
    // Remove tags HTML existentes mantendo o texto
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;
    const plainText = tempDiv.innerText;
    // Separa o texto em linhas, considerando múltiplos tipos de quebras
    const lines = plainText
      .split(/[\n\r]+/)
      .map(line => line.trim())
      .filter(line => line);
    // Formata cada linha e seus subitens
    const formattedLines = lines.map(line => {
      // Primeiro, procura por ":"
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const label = line.substring(0, colonIndex).trim();
        let value = line.substring(colonIndex + 1).trim();
        // Só formata se tivermos texto antes e depois dos dois pontos
        if (label && value) {
          // Remove tags HTML que possam estar presentes
          const cleanLabel = label.replace(/(<([^>]+)>)/gi, '');
          // Se houver pontos finais no valor, trata como subitens
          if (value.includes('. ')) {
            const subitems = value
              .split(/\.\s+/)
              .filter(item => item.trim())
              .map((item, index, array) => {
                const cleanItem = item.replace(/(<([^>]+)>)/gi, '');
                // Adiciona ponto final de volta em todos exceto o último
                return index < array.length - 1 ? cleanItem + '.' : cleanItem;
              });
            // Formata cada subitem em itálico
            const formattedSubitems = subitems.map(item => `<em>${item}</em>`);
            return `<p><strong>${cleanLabel}</strong>: ${formattedSubitems.join(' ')}</p>`;
          } else {
            // Sem subitens, formata normalmente
            const cleanValue = value.replace(/(<([^>]+)>)/gi, '');
            return `<p><strong>${cleanLabel}</strong>: <em>${cleanValue}</em></p>`;
          }
        }
      }
      return `<p>${line}</p>`;
    });
    // Define o novo conteúdo formatado
    editor.value.commands.setContent(formattedLines.join(''));
  }
}

// Limpa o editor quando o componente é destruído
onBeforeUnmount(() => {
  editor.value?.destroy()
})
</script>

<style scoped>
.editor-wrapper {
  margin-bottom: 1rem;
}

.editor-toolbar {
  padding: 0.5rem;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  background-color: #f8fafc;
  border-top-left-radius: 0.375rem;
  border-top-right-radius: 0.375rem;
}

.toolbar-button {
  padding: 0.25rem 0.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.25rem;
  background-color: white;
  cursor: pointer;
  font-size: 0.875rem;
}

.toolbar-button:hover {
  background-color: #f1f5f9;
}

.toolbar-button.is-active {
  background-color: #e2e8f0;
}

.toolbar-separator {
  width: 1px;
  background-color: #e2e8f0;
  align-self: stretch;
}

:deep(.ProseMirror) {
  padding: 1rem;
  min-height: 150px;
  outline: none;
}

:deep(.ProseMirror p) {
  margin: 0.5em 0;
}


:deep(.ProseMirror ul),
:deep(.ProseMirror ol) {
  padding-left: 1.5em;
}
</style>
