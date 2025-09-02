module.exports = {
  extractTagFromComment(tagName, commentText) {
    const regex = new RegExp(`@${tagName}\\s+([^\\s]+)`, 'g');

    const tags = new Set();
    let match = regex.exec(commentText);

    while (match !== null) {
      tags.add(match[1]);
      match = regex.exec(commentText);
    }

    return tags;
  },
};
