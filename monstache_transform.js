module.exports = function(doc) {
    if (!doc.tags) return doc
    let newTags = ''
    for (let key in doc.tags)
        newTags += ' '+key
    doc.tags = newTags.trim()
    return doc
}