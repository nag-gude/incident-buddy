from app.services.llm_gateway import _template_response


def test_template_comms_response_is_empty():
    result = _template_response("comms")
    assert result.text == ""
    assert result.route == "template-mode"


def test_template_analysis_response_has_content():
    result = _template_response("analysis")
    assert result.text.strip() != ""
