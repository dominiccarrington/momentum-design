// Start AI-Assisted
const fs = require('fs');
const path = require('path');

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Compare @cssproperty TSDoc comments with CSS variables defined in .styles.ts files',
    },
    schema: [],
  },
  create(context) {
    /**
     * Extract CSS property names from cssproperty TSDoc comments
     * @param commentText - The JSDoc comment text
     * @returns Set of CSS property names
     */
    function extractCssPropertiesFromComment(comment) {
      const commentText = comment.value;
      const cssProperties = new Map();

      commentText.split('\n').forEach((commentLine, lineNumber) => {
        if (commentLine.includes('@cssproperty')) {
          const match = /@cssproperty\s+(--[^\s]+)/g.exec(commentLine);
          if (match) {
            cssProperties.set(match[1], {
              line: comment.loc.start.line + lineNumber,
              start: comment.loc.start.column + match.index,
              end: comment.loc.start.column + match.index + match[0].length,
            });
          }
        }
      });

      return cssProperties;
    }

    /**
     * Extract CSS variable names from styles file content within :host blocks
     * @param stylesContent - The styles file content
     * @returns Set of CSS variable names
     */
    function extractCssVariablesFromStyles(stylesContent) {
      const cssVariables = new Set();

      // Find all :host blocks in the content
      const hostBlockPattern = /:host\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
      let hostMatch = hostBlockPattern.exec(stylesContent);

      while (hostMatch !== null) {
        const hostBlockContent = hostMatch[0];

        // Extract CSS variables from within this :host block
        const cssVariablePattern = /--([\w-]+):/g;
        let variableMatch = cssVariablePattern.exec(hostBlockContent);

        while (variableMatch !== null) {
          cssVariables.add(`--${variableMatch[1]}`);
          variableMatch = cssVariablePattern.exec(hostBlockContent);
        }

        hostMatch = hostBlockPattern.exec(stylesContent);
      }

      return cssVariables;
    }

    /**
     * Get the corresponding styles file path for a component file
     * @param componentFilePath - Path to the component file
     * @returns Path to the styles file or null if not found
     */
    function getStylesFilePath(componentFilePath) {
      const dir = path.dirname(componentFilePath);
      const basename = path.basename(componentFilePath, '.component.ts');
      const stylesFilePath = path.join(dir, `${basename}.styles.ts`);

      if (fs.existsSync(stylesFilePath)) {
        return stylesFilePath;
      }

      return null;
    }

    /**
     * Read and return the content of a file
     * @param filePath - Path to the file
     * @returns File content or null if unable to read
     */
    function readFileContent(filePath) {
      try {
        return fs.readFileSync(filePath, 'utf8');
      } catch (error) {
        return null;
      }
    }

    return {
      ClassDeclaration(node) {
        const filename = context.getFilename();

        // Only process .component.ts files
        if (!filename.endsWith('.component.ts')) {
          return;
        }

        const sourceCode = context.getSourceCode();
        const allCommentsBeforeClass = sourceCode.getCommentsBefore(node);

        // Find JSDoc comments containing cssproperty
        const cssPropertiesLocations = new Map();
        const cssPropertiesFromDoc = new Set();

        allCommentsBeforeClass.forEach(comment => {
          if (comment.type === 'Block' && comment.value.includes('@cssproperty')) {
            const extractedProperties = extractCssPropertiesFromComment(comment);
            extractedProperties.forEach((value, prop) => {
              cssPropertiesFromDoc.add(prop);
              cssPropertiesLocations.set(prop, value);
            });
          }
        });

        // Find corresponding styles file
        const stylesFilePath = getStylesFilePath(filename);
        if (!stylesFilePath) {
          return;
        }

        // Read styles file content
        const stylesContent = readFileContent(stylesFilePath);
        if (!stylesContent) {
          return;
        }

        // Extract CSS variables from styles file
        const cssVariablesFromStyles = extractCssVariablesFromStyles(stylesContent);

        // Compare documented properties with defined variables
        const documentedButNotDefined = new Set();
        const definedButNotDocumented = new Set();

        // Check for documented properties that are not defined in styles
        cssPropertiesFromDoc.forEach(prop => {
          if (!cssVariablesFromStyles.has(prop)) {
            documentedButNotDefined.add(prop);
          }
        });

        // Check for defined variables that are not documented
        cssVariablesFromStyles.forEach(variable => {
          if (!cssPropertiesFromDoc.has(variable)) {
            definedButNotDocumented.add(variable);
          }
        });

        documentedButNotDefined.forEach(prop => {
          const loc = cssPropertiesLocations.get(prop);
          context.report({
            node,
            loc: {
              start: { line: loc.line, column: loc.start },
              end: { line: loc.line, column: loc.end },
            },
            message: `CSS property documented with @cssproperty but not defined in styles file: {{prop}}`,
            data: { prop },
          });
        });

        definedButNotDocumented.forEach(variable =>
          context.report({
            node,
            loc: node.id.loc,
            message: `CSS variable defined in styles file but not documented with @cssproperty: {{variable}}`,
            data: { variable },
          }),
        );
      },
    };
  },
};
// End AI-Assisted
