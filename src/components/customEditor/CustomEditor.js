import React, { Component } from 'react';
import { connect } from 'react-redux';
import { EditorState, ContentState } from 'draft-js';
import { asyncSetComments, setComment } from '../../redux/actions/articleActions';
import { Editor } from 'react-draft-wysiwyg';
import 'react-draft-wysiwyg/dist/react-draft-wysiwyg.css';
import './CustomEditor.css';
import { checkDarkMode } from '../../utils/CheckDarkMode.js';
import ReCAPTCHA from "react-google-recaptcha";

const recaptchaRef = React.createRef();

class CustomEditor extends Component {
  constructor(props) {
    super(props);
    this.state = {
      editorState: EditorState.createEmpty(),
      username: "",
      submit: false,
      event: null
    }
  }

  onContentChange = (editorState) => {
    this.props.setComment({id: this.props.commentId, username: null, commentType: this.props.commentType, comment: editorState.blocks[0].text}); 
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
  addComment = () => { 
    var e = this.state.event   
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
      event: null
    })

    recaptchaRef.reset();
  }

  changeSubmit = (e) => {
    e.preventDefault();

    if(this.state.submit === false) {
      this.setState({
        submit: true,
        event: e
      })
    }
  }

  render() {
    return (
      <form className="createPostContainer" onSubmit={(e) => this.changeSubmit(e)}>
        <div className="postUsernameContainer">
          <input type="text" name="username" className="postUsername" value={this.state.username} placeholder="username || anon" onChange={(e) => this.handleUsernameChange(e)}/>
        </div>
        <Editor
          editorState={this.state.editorState}
          toolbarClassName="toolbarContainer"
          wrapperClassName="editorWrapperContainer"
          editorClassName={'editorContainer' + checkDarkMode(this.props.darkMode, true)}
          toolbar={{
            options: [],
            inline: { inDropdown: true },
            list: { inDropdown: true },
            textAlign: { inDropdown: true },
            link: { inDropdown: true },
            history: { inDropdown: true },
          }}
          onChange={this.onContentChange}
          onEditorStateChange={this.onEditorStateChange}
        />
        {this.state.submit && 
          <ReCAPTCHA
            ref={recaptchaRef}
            sitekey="6LeEVYkUAAAAAEGkI1okLmQqpOXHuQXYzrFj3mmV"
            onChange={this.addComment}
          />
        }
        <div className="postCommentContainer">
          <input name="submitButton" className={'commentSubmitButton' + checkDarkMode(this.props.darkMode, true)} type="submit" value="Submit" />
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
