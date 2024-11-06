const pb = {
  le: "<:5499lb2g:1299663909040558160>",
  me: "<:2827l2g:1299663896218570805>",
  re: "<:2881lb3g:1299663884562468874>",
  lf: "<:5988lbg:1299663872071831622>",
  mf: "<:3451lg:1299663858914295818>",
  rf: "<:3166lb4g:1299663843827650681>",
};

function formatResults(upvotes = [], downvotes = []) {
  const totalVotes = upvotes.length + downvotes.length;
  const progressBarLength = 14;
  const filledSquares =
    Math.round((upvotes.length / totalVotes) * progressBarLength) || 0;
  const emptySquares = progressBarLength - filledSquares || 0;

  const upPercentage = (upvotes.length / totalVotes) * 100 || 0;
  const downPercentage = (downvotes.length / totalVotes) * 100 || 0;

  const progressBar =
    (filledSquares ? pb.lf : pb.le) +
    (pb.mf.repeat(filledSquares) + pb.me.repeat(emptySquares)) +
    (filledSquares === progressBarLength ? pb.rf : pb.re);

  return `👍 ${upvotes.length} głosów na tak (${upPercentage.toFixed(
    1
  )}%) • 👎 ${downvotes.length} głosów na nie (${downPercentage.toFixed(
    1
  )}%)\n${progressBar}`;
}

module.exports = formatResults;
