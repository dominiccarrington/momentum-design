const { TemplateAnalyzer } = require('eslint-plugin-lit/lib/template-analyzer.js');

module.exports = {
  meta: {},
  create(context) {
    function extractSlotsFromComment(commentText) {
      const regex = /@slot\s+([^\s]+)/g;
      const slots = new Set();
      let match = regex.exec(commentText);

      while (match !== null) {
        slots.add(match[1]);
        match = regex.exec(commentText);
      }

      return slots;
    }

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
          const slots = new Set(commentsBeforeClass.map(comment => [...extractSlotsFromComment(comment.value)]).flat());

          const analyzer = TemplateAnalyzer.create(node);

          analyzer.traverse({
            enterElement(element) {
              if (element.name !== 'slot') {
                return;
              }

              if (element.attribs.name === undefined) {
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
