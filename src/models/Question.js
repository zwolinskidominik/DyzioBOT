const { Schema, model } = require('mongoose');
const { randomUUID } = require('crypto');

const questionSchema = new Schema({
    questionId: {
        type: String,
        default: randomUUID,
    },
    authorId: {
        type: String,
        required: true,
    },
    content: {
        type: String,
        required: true,
    },
});

module.exports = model('Question', questionSchema);