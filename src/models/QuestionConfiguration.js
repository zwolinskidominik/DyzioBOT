const { Schema, model } = require('mongoose');

const QuestionConfigurationSchema = new Schema({
    guildId: {
        type: String,
        required: true,
    },
    questionChannelId: {
        type: String,
        required: true,
    },
    pingRoleId: {
        type: String,
        default: null,
    },
});

module.exports = model('QuestionConfiguration', QuestionConfigurationSchema);
