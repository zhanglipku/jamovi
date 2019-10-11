
#include "serialise.h"

#include "jamovi.pb.h"

using namespace Rcpp;
using namespace std;
using namespace jamovi::coms;

#define R6 Rcpp::Environment

#define INT(x) (Rcpp::as<int>(x))
#define STRING(x) (Rcpp::as<string>(x))
#define FUNC(x) (Rcpp::as<Rcpp::Function>(x))
#define BOOL(x) (Rcpp::as<bool>(x))
#define ENV(x) (Rcpp::as<Environment>(x))

void resultsToPB(R6 &source, ResultsElement *target, AnalysisStatus override);
void columnToPB(R6 &source, ResultsColumn *target);
void cellToPB(Environment &source, ResultsCell *target);

void serialise(R6 &ana, bool incAsText, string &out)
{
    Environment priv = ENV(ana.get(".__enclos_env__")).get("private");

    static Environment base("package:base");
    static Function procTime = base.get("proc.time");
    static Function minus = base.get("-");

    SEXP time = procTime();

    AnalysisResponse response;

    response.set_instanceid(STRING(priv.get(".datasetId")));
    response.set_analysisid(INT(priv.get(".analysisId")));
    response.set_name(STRING(priv.get(".name")));
    response.set_ns(STRING(priv.get(".package")));

    Rcpp::IntegerVector v = priv.get(".version");
    int version = v[0] * 16777216 + v[1] * 65536 + v[2] * 256;
    response.set_version(version);

    response.set_revision(INT(priv.get(".revision")));

    string s = STRING(priv.get(".status"));

    AnalysisStatus status = AnalysisStatus::ANALYSIS_ERROR;
    if (s == "inited")
        status = AnalysisStatus::ANALYSIS_INITED;
    else if (s == "running")
        status = AnalysisStatus::ANALYSIS_RUNNING;
    else if (s == "complete")
        status = AnalysisStatus::ANALYSIS_COMPLETE;

    response.set_status(status);

    if (STRING(priv[".stacktrace"]) != "")
    {

    }

    R6 results = ana["results"];
    ResultsElement *resultsPB = response.mutable_results();

    resultsToPB(results, resultsPB, status);

    print(minus(procTime(), time));

    response.SerializeToString(&out);
}

RawVector toRDS(SEXP obj)
{
    static Environment base("package:base");
    static Function rawConnection = base.get("rawConnection");
    static Function rawConnectionValue = base.get("rawConnectionValue");
    static Function saveRDS = base.get("saveRDS");
    static Function close = base.get("close");

    RawVector raw;

    if (obj != R_NilValue)
    {
        SEXP conn = rawConnection(RawVector(), "r+");
        saveRDS(obj, Named("file") = conn);
        raw = rawConnectionValue(conn);
        close(conn);
    }

    return raw;
}

void resultsToPB(R6 &source, ResultsElement *target, AnalysisStatus override)
{
    std::cout << "Processing " << STRING(source["path"]) << "\n";
    std::cout.flush();

    static Function getNamespace = Environment("package:base")["getNamespace"];

    Environment priv = ENV(source.get(".__enclos_env__")).get("private");

    target->set_name(STRING(priv.get(".name")));
    target->set_title(STRING(source.get("title")));
    target->set_stale(BOOL(priv.get(".stale")));

    SEXP visibleExpr = priv[".visibleExpr"];
    Visible vis = Visible::DEFAULT_NO;
    if (is<String>(visibleExpr))
    {
        string visible = STRING(visibleExpr);
        if (visible == "TRUE")
            vis = Visible::YES;
        else if (visible == "FALSE")
            vis = Visible::NO;
    }
    if (vis == Visible::DEFAULT_NO && BOOL(source["visible"]))
        vis = Visible::DEFAULT_YES;
    target->set_visible(vis);

    string status = priv[".status"];

    AnalysisStatus s = AnalysisStatus::ANALYSIS_NONE;
    if (status == "error")
        s = AnalysisStatus::ANALYSIS_ERROR;
    else if (status == "running")
        s = AnalysisStatus::ANALYSIS_RUNNING;
    else if (status == "inited")
        s = AnalysisStatus::ANALYSIS_INITED;
    else if (status == "complete")
        s = AnalysisStatus::ANALYSIS_COMPLETE;

    if (override == AnalysisStatus::ANALYSIS_NONE)
        ; // do nothing
    else if (override == AnalysisStatus::ANALYSIS_ERROR)
        s = override;
    else if (override == AnalysisStatus::ANALYSIS_COMPLETE)
        s = override;
    else if (override == AnalysisStatus::ANALYSIS_RUNNING &&
            s != AnalysisStatus::ANALYSIS_COMPLETE)
        s = override;
    else if (override == AnalysisStatus::ANALYSIS_INITED &&
            s == AnalysisStatus::ANALYSIS_NONE)
        s = override;
    target->set_status(s);

    if (status == "error")
    {
        string error = STRING(priv.get(".error"));
        target->mutable_error()->set_message(error);
    }

    SEXP state = priv[".state"];
    RawVector raw = toRDS(state);
    target->set_state(string(raw.begin(), raw.end()));

    CharacterVector classes = source.attr("class");
    print(classes);
    string cl4ss = STRING(classes[0]);

    if (cl4ss == "Group")
    {
        ResultsGroup *group = target->mutable_group();
        List children = priv[".items"];
        for (R6 child : children)
        {
            ResultsElement *elem = group->add_elements();
            resultsToPB(child, elem, override);
        }
    }
    else if (cl4ss == "Table")
    {
        static Environment jmvcore = Environment::namespace_env("jmvcore");
        static Environment columnTemp = as<Function>(jmvcore["columnTemp"])();
        static Environment column = columnTemp.get("column");

        ResultsTable *table = target->mutable_table();

        Function getColumn = source["getColumn"];
        int columnCount = source["columnCount"];

        List columns = priv[".columns"];

        print(source["columnCount"]);
        for (int i = 0; i < columnCount; i++)
        {
            ENV(column.get(".__enclos_env__"))["private"] = columns[i];
            // SEXP column = getColumn(i+1, "Table$getColumn()");
            // print(column);
            ResultsColumn *columnPB = table->add_columns();
            columnToPB(column, columnPB);
        }
    }
    else if (cl4ss == "Image")
    {
        // ResultsImage *image = target->mutable_image();
        // SEXP fp = priv[".filePath"];
        // if (fp != R_NilValue && is<String>(fp))
        //     image->set_path(STRING(fp));
        // image->set_width(INT(priv[".width"]));
        // image->set_height(INT(priv[".height"]));
    }
    else if (cl4ss == "Array")
    {
        ResultsArray *array = target->mutable_array();

        List children = priv[".items"];
        for (R6 child : children)
        {
            ResultsElement *elem = array->add_elements();
            resultsToPB(child, elem, override);
        }

        if (STRING(priv[".layout"]) == "listSelect")
            array->set_layout(ResultsArray_LayoutType_LIST_SELECT);

        if (BOOL(priv[".hideHeadingOnlyChild"]))
            array->set_hideheadingonlychild(true);
    }
    else if (cl4ss == "Preformatted")
    {
        target->set_preformatted(STRING(priv[".content"]));
    }
    else if (cl4ss == "Syntax")
    {
        target->set_syntax(STRING(priv[".content"]));
    }
    else if (cl4ss == "Html")
    {
        ResultsHtml *html = target->mutable_html();
        html->set_content(STRING(priv[".content"]));
        for (SEXP script : as<StringVector>(priv[".scripts"]))
            html->add_scripts(STRING(script));
        for (SEXP ss : as<StringVector>(priv[".scripts"]))
            html->add_stylesheets(STRING(ss));
    }

    // std::cout << "Processed " << STRING(source["path"]) << "\n";
    // std::cout.flush();
}

void columnToPB(R6 &source, ResultsColumn *target)
{
    Environment priv = ENV(source.get(".__enclos_env__")).get("private");

    SEXP visibleExpr = priv[".visibleExpr"];
    Visible vis = Visible::DEFAULT_NO;
    if (is<String>(visibleExpr))
    {
        string visible = STRING(visibleExpr);
        if (visible == "TRUE")
            vis = Visible::YES;
        else if (visible == "FALSE")
            vis = Visible::NO;
    }
    if (vis == Visible::DEFAULT_NO && BOOL(source["visible"]))
        vis = Visible::DEFAULT_YES;
    target->set_visible(vis);

    target->set_name(STRING(priv[".name"]));
    target->set_title(STRING(priv[".title"]));
    target->set_type(STRING(priv[".type"]));
    // if (BOOL(source["hasSuperTitle"]))
    //     target->set_supertitle(STRING(source["superTitle"]));
    //
    // StringVector format = priv[".format"];
    // stringstream ss;
    // string sep = "";
    // for (SEXP tok : format)
    // {
    //     ss << sep << STRING(tok);
    //     sep = ",";
    // }
    // target->set_format(ss.str());
    //
    // target->set_combinebelow(BOOL(priv[".combineBelow"]));
    // target->set_sortable(BOOL(priv[".sortable"]));
    // target->set_hassortkeys(BOOL(priv[".hasSortKeys"]));

    List cells = priv[".cells"];
    for (Environment cell : cells)
    {
        ResultsCell *cellPB = target->add_cells();
        cellToPB(cell, cellPB);
    }
}

void cellToPB(Environment &source, ResultsCell *target)
{
    SEXP v = source[".value"];

    if (LENGTH(v) != 1)
    {
        target->set_o(ResultsCell_Other_MISSING);
    }
    else if (is<NumericVector>(v))
    {
        target->set_d(as<double>(v));
    }
    else if (is<IntegerVector>(v))
    {
        int value = as<int>(v);
        if (value == -2147483648)
            target->set_o(ResultsCell_Other_MISSING);
        else
            target->set_i(value);
    }
    else if (is<CharacterVector>(v))
    {
        string str = as<String>(v);
        target->set_s(str);
    }
    else
    {
        target->set_o(ResultsCell_Other_NOT_A_NUMBER);
    }

    // StringVector footnotes = source[".footnotes"];
    // for (SEXP footnote : footnotes)
    //     target->add_footnotes(CHAR(footnote));
    //
    // StringVector symbols = source[".symbols"];
    // for (SEXP symbol : symbols)
    //     target->add_symbols(CHAR(symbol));

}
