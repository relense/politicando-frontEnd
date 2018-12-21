import React, { Component } from 'react';
import { connect } from 'react-redux';
import { EditorState, ContentState } from 'draft-js';
import { asyncSetComments, setComment } from '../../redux/actions/articleActions';
import { Editor } from 'react-draft-wysiwyg';
import 'react-draft-wysiwyg/dist/react-draft-wysiwyg.css';
import './CustomEditor.css';
import { checkDarkMode } from '../../utils/CheckDarkMode.js';

class CustomEditor extends Component {
  constructor(props) {
    super(props);
    this.state = {
      editorState: EditorState.createEmpty()
    }
  }

  onContentStateChange = (editorState) => {
    let size = 0;

    if (editorState.blocks.length === 1) 
      size = 0
    else 
      size = (editorState.blocks.length - 1) * 100;

    let characters = editorState.blocks[0].text.length;

    this.props.setComment({id: this.props.commentId, username: null, commentType: this.props.commentType, comment: editorState.blocks[0].text}, (size + characters)); 
  }

  onEditorStateChange = (editorState) => {
    this.setState({
      editorState
    })
  }

  addCommentPost = (e) => {
    e.preventDefault();
    
    let comment = {};
    comment = this.props.comment;
    
    if(comment !== "" && this.props.loading === false){
      comment.username = e.target.username.value;
      const editorState = EditorState.push(this.state.editorState, ContentState.createFromText(''), 'remove-range');

      this.setState({ 
        editorState: editorState,
      });  

      this.props.setComments(comment, this.props.articleId);
    }
  }

  addCommentReply = (e) => {
    e.preventDefault();
    
    let comment = {};
    comment = this.props.comment;
    
    if(comment !== "" && this.props.loading === false){
      comment.username = e.target.username.value;
      const editorState = EditorState.push(this.state.editorState, ContentState.createFromText(''), 'remove-range');

      this.setState({ 
        editorState: editorState,
      });  

      this.props.setComments(comment, this.props.articleId);
    }
  }

  render() {
    return (
      <form className="createPostContainer" onSubmit={(e) => this.addCommentPost(e)}>
        <div className="postUsernameContainer">
          <input type="text" name="username" className="postUsername" placeholder="username || anon"/>
        </div>
        <Editor
          editorState={this.state.editorState}
          toolbarClassName="toolbarContainer"
          wrapperClassName="editorWrapperContainer"
          editorClassName={'editorContainer' + checkDarkMode(this.props.darkMode, true)}
          toolbar={{
            options: ['inline', 'list', 'colorPicker', 'link', 'remove', 'history'],
            inline: { inDropdown: true },
            list: { inDropdown: true },
            textAlign: { inDropdown: true },
            link: { inDropdown: true },
            history: { inDropdown: true },
          }}
          onChange={this.onContentStateChange}
          onEditorStateChange={this.onEditorStateChange}
        />
        <div className="postCommentContainer">
          <input className={'commentSubmitButton' + checkDarkMode(this.props.darkMode, true)} type="submit" value="Submit" />
        </div>
      </form>
    )
  }
}

function mapStateToProps(state) {
  return {
    loading: state.article.loading,
    comment: state.article.comment,
    comments: state.article.comments,
    darkMode: state.view.darkMode,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    setComments: (comment, articleId) =>  {
      dispatch(asyncSetComments(comment, articleId));
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
