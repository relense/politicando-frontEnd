import React, { Component } from 'react';
import { connect } from 'react-redux';
import { EditorState, ContentState } from 'draft-js';
import { asyncSetComments, setComment } from '../../redux/actions/articleActions';
import 'react-draft-wysiwyg/dist/react-draft-wysiwyg.css';
import './CustomEditor.css';
import { checkDarkModeEditor } from '../../utils/CheckDarkMode.js';
import ReCAPTCHA from "react-google-recaptcha";

const recaptchaRef = React.createRef();

class CustomEditor extends Component {
  constructor(props) {
    super(props);
    this.state = {
      editorState: EditorState.createEmpty(),
      username: "",
      submit: false,
      commentContent: ""    
    }
  }

  onContentChange = (e) => {
    if(e.target.rows <= 5) {
      this.props.setComment({id: this.props.commentId, username: null, commentType: this.props.commentType, comment: e.target.value}); 
      this.setState({
        commentContent: e.target.value
      })
    }
  }

  onEditorStateChange = (editorState) => {
    this.setState({
      editorState
    });
  }

  handleUsernameChange = (e) => {
    var username = e.target.value.replace(/ +/g, "");
    if(username.length >= 10) {
      username = username.substring(0, 20);
    }
    this.setState({
      username: username
    })
  }

  /**
   * Function to add a comment after the user hits submit.
   * This will set the comments int he database.
   * This will also close the reply box after submit.
   * This will also focus on the new comment that was added.
   */
  onSubmit = (e) => { 
    e.preventDefault();

    if(this.state.submit) {
      let comment = {};
      comment = this.props.comment;
      
      if(comment !== ""){
        comment.username = e.target.username.value.replace(/ +/g, "");
        const editorState = EditorState.push(this.state.editorState, ContentState.createFromText(''), 'remove-range');

        this.setState({ 
          editorState: editorState,
        });  

        this.props.setComments(comment, this.props.currentArticle.id, this.props.comments);

        if(this.props.closeReplyBox !== null && this.props.closeReplyBox !== undefined && this.props.reply) {
          this.props.closeReplyBox();
        }
      }

      this.setState({
        submit: false,
        commentContent: ""
      })

      window.grecaptcha.reset();
    }
  }

  changeSubmit = (e) => {
    if(this.state.submit === false) {
      this.setState({
        submit: true,
      });
    }
  }

  render() {
    return (
      <form className="createPostContainer" onSubmit={this.onSubmit}>
        <div className="postUsernameContainer">
          <input autoComplete="off" autoCorrect="off" type="text" name="username" className="postUsername" value={this.state.username} placeholder="username || anon" onChange={(e) => this.handleUsernameChange(e)}/>
        </div>
        <div className="editorWrapperContainer">
          <textarea autoComplete="off" autoCorrect="off" maxLength="500" type="text" name="commentContent" className={"editorContainer" + checkDarkModeEditor(this.props.darkMode, true)} value={this.state.commentContent} onChange={(e) => this.onContentChange(e)}/>
        </div>
        <div className="reCaptcha">
          <ReCAPTCHA
            ref={recaptchaRef}
            sitekey="6LeEVYkUAAAAAEGkI1okLmQqpOXHuQXYzrFj3mmV"
            onChange={this.changeSubmit}
          /> 
        </div>
        <div className="postCommentContainer">
          <input name="submitButton" className={'commentSubmitButton'} type="submit" value="Submit" />
        </div>
      </form>
    )
  }
}

function mapStateToProps(state) {
  return {
    comment: state.article.comment,
    comments: state.article.currentArticleComments,
    darkMode: state.view.darkMode,
    currentArticle: state.article.currentArticle,
    reply: state.article.reply
  };
}

function mapDispatchToProps(dispatch) {
  return {
    setComments: (comment, articleId, comments) =>  {
      dispatch(asyncSetComments(comment, articleId, comments));
    },
    setComment: (comment, characters) => {
      dispatch(setComment(comment, characters))
    }
   }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(CustomEditor);
