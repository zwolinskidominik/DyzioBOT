const { Schema, model } = require('mongoose');

const QuestionConfigurationSchema = new Schema({
    guildId: {
        type: String,
        required: true,
        unique: true,
    },
    questionChannelId: {
        type: String,
        required: true,
    },
});

module.exports = model('QuestionConfiguration', QuestionConfigurationSchema);
