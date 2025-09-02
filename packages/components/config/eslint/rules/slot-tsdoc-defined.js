const { TemplateAnalyzer } = require('eslint-plugin-lit/lib/template-analyzer.js');

const { extractTagFromComment } = require('../utils/extract-tsdoc-from-comments.js');

module.exports = {
  meta: {},
  create(context) {
    return {
      TaggedTemplateExpression: node => {
        if (node.type === 'TaggedTemplateExpression' && node.tag.type === 'Identifier' && node.tag.name === 'html') {
          let classNode = node;
          do {
            classNode = classNode.parent;
          } while (classNode && classNode.type !== 'ClassDeclaration');

          if (!classNode) {
            return;
          }

          const commentsBeforeClass = context.getCommentsBefore(classNode);
          const slots = new Set(
            commentsBeforeClass.map(comment => [...extractTagFromComment('slot', comment.value)]).flat(),
          );

          const analyzer = TemplateAnalyzer.create(node);

          analyzer.traverse({
            enterElement(element) {
              if (element.name !== 'slot') {
                return;
              }

              if (element.attribs.name === undefined) {
                return;
              }

              // Ignore dynamic parts
              if (element.attribs.name.startsWith('{{__Q:')) {
                return;
              }

              if (!slots.has(element.attribs.name)) {
                context.report({
                  node: classNode.id,
                  message: `The slot "${element.attribs.name}" is used in a template but is missing a @slot TSDoc.`,
                });
              }
            },
          });
        }
      },
    };
  },
};
