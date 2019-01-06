import React, { Component } from 'react';
import { connect } from 'react-redux'
import './Comment.css';
import { setEditorIndex, asyncSetReply, removeAddedComment, openCloseCommentBox, setChildComments } from '../../redux/actions/articleActions';
import moment from 'moment'
import { checkDarkMode, checkDarkModeLinks } from '../../utils/CheckDarkMode.js';
import CustomEditor from '../customEditor/CustomEditor.js';

class Comment extends Component {
  reply = () => {
    this.props.changeReplyAndEditor(this.props.commentId, this.props.editorIndex);
  }

  opened = () => {
    this.props.setCommentBoxState(this.props.currentArticleComments, this.props.comment.opened, this.props.comment.id);
  }

  onChildrenClick = (child) => {
    this.props.setChildComments(this.props.currentArticleComments, child);
  }
  
  /**
   * Function to draw in the header the replys to a comment. This will help to navigate throught the comments.
   */
  setChildren = () => {
    return (
      this.props.comment.children.map((item) => 
        <div className={'childrenContainer commentPointer selectForbiden' 
          + (this.props.comment.child !== null ? (this.props.comment.child.id === item.id ? " hilighlightChild" : "") : "")
          + checkDarkModeLinks(this.props.darkMode, true)} 
          key={item.id} 
          onClick={() => this.onChildrenClick(item)}
        >
          {(item.username !== null ? item.username : 'anon') + item.id}
        </div>
      )
    );
  }

  /**
   * Function used to draw the header of a comments. Includes open a close button.
   * Includes the usernameId of the poster. The time it was posted. The replys associated with the comment if they exist.
   */
  commentHeader = () => {
    let sign = this.props.comment.opened ? "[-]" : "[+]";
    let username = this.props.comment.username ? this.props.comment.username + this.props.comment.id : "anon" + this.props.comment.id;
    let time = moment(this.props.comment.created_at).format('DD-MM-YYYY | HH:mm');
    let children = this.props.comment.children !== undefined && this.props.comment.children !== null ? true : false;

    return(
      <div className="commentHeader">
        <div className="sign" onClick={this.opened}>
          {sign}
        </div>
        <div className={'commentPointer commentUsernameContainer' + checkDarkModeLinks(this.props.darkMode, true)} onClick={this.reply}>
          {username}
        </div>
        <div className="answer"> | </div>
        <div className="selectForbiden commentTime">
          {time}
        </div>
        {this.props.comment.opened ? 
          <div className="childrenMainContainer">
           {children ? this.setChildren() : null}
          </div>
          : 
          <div className="childrenContainer">
            {(children ? this.props.comment.children.length : 0 ) + ' respostas'}
          </div>
        }
      </div>
    )
  }

  /**
   * Function to render the reply box
   */
  renderEditor = () => {
    if(this.props.reply && this.props.comment.opened && this.props.editorIndexState) 
      return <CustomEditor commentType={"reply"} commentId={this.props.commentId} closeReplyBox={this.reply} />
    else 
      return null
  }

  /**
   * Function to render the child comment when it is clicked
   */
  renderChildComment = () => {
    if(this.props.comment.child !== null && this.props.comment.child !== undefined) { 
      return (
        <ConnectedComment comment={this.props.comment.child} commentId={this.props.comment.child.id} 
          editorIndexState={this.props.editorIndex === this.props.comment.child.id ? true : false }
        />
      )
    } else 
      return null
  }

  render() {
    let renderer;

    if(this.props.currentArticle !== null && this.props.currentArticle !== undefined && this.props.comment !== null) {
      renderer = (
        <div id={this.props.comment.id} className={'commentParentContainer' + checkDarkMode(this.props.darkMode, true)}>
          {this.commentHeader()} 
          <div style={{display: this.props.comment.opened ? '' : 'none'}}>
            <div className={"commentContent" + checkDarkMode(this.props.darkMode, true)}>
              {this.props.comment.comment}
            </div>
            {this.renderEditor()}
            <div className="commentFooter">
              <div className={"commentPointer replyButton" + checkDarkMode(this.props.darkMode, true)} onClick={this.reply}>responder</div>
            </div>
          </div>        
          {this.renderChildComment()}
        </div>
      );
    } else 
      renderer = null;
    
    return renderer;
  }
}

function mapStateToProps(state, ownProps) {
  return {
    darkMode: state.view.darkMode,
    currentArticle: state.article.currentArticle,
    currentArticleComments: state.article.currentArticleComments,
    editorIndex: state.article.editorIndex,
    reply: state.article.reply,
    addedComment: state.article.addedComment,
  };
}

function mapDispatchToProps(dispatch) {
  return { 
    changeEditorIndex: (index) => {
      dispatch(setEditorIndex(index));
    },
    changeReplyAndEditor: (commentId, editorIndex) => {
      dispatch(asyncSetReply(commentId, editorIndex))
    },
    clearAddedComment: () => {
      dispatch(removeAddedComment())
    },
    setCommentBoxState: (comments, opened, commentId) => {
      dispatch(openCloseCommentBox(comments, opened, commentId))
    },
    setChildComments: (comments, child) => {
      dispatch(setChildComments(comments, child))
    }
  };
}

const ConnectedComment = connect(mapStateToProps, mapDispatchToProps)(Comment);
export default ConnectedComment;