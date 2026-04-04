module.exports = {
    ConvertTitleToSlug: function (title) {
        if (!title) return "";
        let result = title.toLowerCase();
        result = result.replaceAll(' ', '-');
        return result;
    }
}
