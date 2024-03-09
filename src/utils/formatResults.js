const pb = {
    le: '<:5499lb2g:1215474625551536158>',
    me: '<:2827l2g:1215474622997467196>',
    re: '<:2881lb3g:1215474621042659399>',
    lf: '<:5988lbg:1215474632178540544>',
    mf: '<:3451lg:1215474629380931587>',
    rf: '<:3166lb4g:1215474627837558824>',
  };
   
  function formatResults(upvotes = [], downvotes = []) {
    const totalVotes = upvotes.length + downvotes.length;
    const progressBarLength = 14;
    const filledSquares = Math.round((upvotes.length / totalVotes) * progressBarLength) || 0;
    const emptySquares = progressBarLength - filledSquares || 0;
   
    if (!filledSquares && !emptySquares) {
      emptySquares = progressBarLength;
    }
   
    const upPercentage = (upvotes.length / totalVotes) * 100 || 0;
    const downPercentage = (downvotes.length / totalVotes) * 100 || 0;
   
    const progressBar =
      (filledSquares ? pb.lf : pb.le) +
      (pb.mf.repeat(filledSquares) + pb.me.repeat(emptySquares)) +
      (filledSquares === progressBarLength ? pb.rf : pb.re);
   
    const results = [];
    results.push(
      `👍 ${upvotes.length} głosów na tak (${upPercentage.toFixed(1)}%) • 👎 ${
        downvotes.length
      } głosów na nie (${downPercentage.toFixed(1)}%)`
    );
    results.push(progressBar);
   
    return results.join('\n');
  }
   
  module.exports = formatResults;