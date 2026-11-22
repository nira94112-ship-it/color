import json
import os

import streamlit as st
from dotenv import load_dotenv
from google import genai
from pypdf import PdfReader

load_dotenv()  # reads GEMINI_API_KEY from a local .env file

MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")


def get_api_key():
    """Get the key from .env / environment, or Streamlit secrets (for hosting)."""
    key = os.getenv("GEMINI_API_KEY")
    if key:
        return key
    try:
        return st.secrets["GEMINI_API_KEY"]
    except Exception:
        return None


def read_pdf(file) -> str:
    reader = PdfReader(file)
    return "\n".join((page.extract_text() or "") for page in reader.pages)


def analyze(resume_text: str, job_desc: str, api_key: str) -> dict:
    client = genai.Client(api_key=api_key)
    prompt = f"""
You are an ATS (Applicant Tracking System) and a career coach.
Compare the RESUME with the JOB DESCRIPTION.

Return ONLY valid JSON in exactly this format:
{{
  "match_score": <integer 0-100>,
  "matching_skills": ["skill", ...],
  "missing_skills": ["skill or keyword", ...],
  "suggestions": ["suggestion 1", "suggestion 2", "suggestion 3", "suggestion 4", "suggestion 5"]
}}

RESUME:
{resume_text}

JOB DESCRIPTION:
{job_desc}
"""
    response = client.models.generate_content(
        model=MODEL,
        contents=prompt,
        config={"response_mime_type": "application/json"},
    )
    text = response.text.strip().replace("```json", "").replace("```", "")
    return json.loads(text)


# ---------------- UI ----------------
st.set_page_config(page_title="AI Resume Analyzer", page_icon="📄")
st.title("📄 AI Resume Analyzer & ATS Score Checker")
st.write("Upload your resume and paste a job description to see how well they match.")

resume_file = st.file_uploader("Upload your resume (PDF)", type=["pdf"])
job_desc = st.text_area("Paste the job description", height=200)

if st.button("Analyze Resume", type="primary"):
    api_key = get_api_key()
    if not api_key:
        st.error("API key not found. Add GEMINI_API_KEY to your .env file.")
    elif resume_file is None or not job_desc.strip():
        st.warning("Please upload a resume and paste a job description.")
    else:
        resume_text = read_pdf(resume_file)
        if not resume_text.strip():
            st.error("Could not read text from this PDF (it may be a scanned image).")
        else:
            with st.spinner("Analyzing with Gemini..."):
                try:
                    result = analyze(resume_text, job_desc, api_key)
                except Exception as e:
                    st.error(f"Something went wrong: {e}")
                    st.stop()

            score = int(result["match_score"])
            st.subheader("Match Score")
            st.metric("ATS Match", f"{score} / 100")
            st.progress(min(max(score, 0), 100) / 100)

            col1, col2 = st.columns(2)
            with col1:
                st.subheader("✅ Matching Skills")
                for s in result["matching_skills"]:
                    st.write(f"- {s}")
            with col2:
                st.subheader("❌ Missing Skills / Keywords")
                for s in result["missing_skills"]:
                    st.write(f"- {s}")

            st.subheader("💡 5 Suggestions to Improve")
            for i, s in enumerate(result["suggestions"], 1):
                st.write(f"{i}. {s}")
