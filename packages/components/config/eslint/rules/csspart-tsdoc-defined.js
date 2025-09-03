const { TemplateAnalyzer } = require('eslint-plugin-lit/lib/template-analyzer.js');

const { extractTagFromComment } = require('../utils/extract-tsdoc-from-comments.js');

module.exports = {
  meta: {},
  create(context) {
    return {
      TaggedTemplateExpression: node => {
        const filename = context.getFilename();

        // Only process .component.ts files
        if (!filename.endsWith('.component.ts')) {
          return;
        }

        if (node.type === 'TaggedTemplateExpression' && node.tag.type === 'Identifier' && node.tag.name === 'html') {
          let classNode = node;
          do {
            classNode = classNode.parent;
          } while (classNode && classNode.type !== 'ClassDeclaration');

          if (!classNode) {
            return;
          }

          const commentsBeforeClass = context.getCommentsBefore(classNode);
          const cssparts = new Set(
            commentsBeforeClass.map(comment => [...extractTagFromComment('csspart', comment.value)]).flat(),
          );

          const analyzer = TemplateAnalyzer.create(node);

          analyzer.traverse({
            enterElement(element) {
              if (element.attribs.part === undefined) {
                return;
              }

              // Ignore dynamic parts
              if (element.attribs.part.startsWith('{{__Q:')) {
                return;
              }

              if (!cssparts.has(element.attribs.part)) {
                context.report({
                  node: classNode.id,
                  message: `The csspart "${element.attribs.part}" is used in a template but is missing a @csspart TSDoc.`,
                });
              }
            },
          });
        }
      },
    };
  },
};
