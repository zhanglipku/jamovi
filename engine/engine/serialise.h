
#include <string>
#include <Rcpp.h>

#undef Free   // #defs left over from R which stuff things up
#undef ERROR

void serialise(Rcpp::Environment &in, bool incAsText, std::string &out);
