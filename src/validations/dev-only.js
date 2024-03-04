module.exports = ({ interaction, commandObj }) => {
    if (commandObj.options.devOnly) {
        if (interaction.user.id !== '548177225661546496') {
            interaction.reply('This command is for the developer only.');
            return true;
        }
    }
}