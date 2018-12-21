import React, { Component } from 'react';
import { connect } from 'react-redux'
import './Comment.css';
import moment from 'moment'
import { checkDarkMode, checkDarkModeLinks } from '../../utils/CheckDarkMode.js';
import CustomEditor from '../customEditor/CustomEditor.js';

class Comment extends Component {
  constructor(props) {
    super(props);
    this.state = {
      reply: false,
      opened: this.props.opened ? this.props.opened : true,
      child: null
    }
  }

  reply = () =>{
    this.setState({
      reply: !this.state.reply
    })
  }

  opened = () => {
    this.setState({
      reply: this.state.opened ? true : false,
      opened: !this.state.opened
    })
  }
  
  onChildrenClick = (comment) => {
      this.setState({
        child: this.state.child === null ? comment : comment.id !== this.state.child.id ? comment : null
      })
  }

  setChildren = () => {
    if(this.props.comment.children !== undefined && this.props.comment.children !== null) {
     return this.props.comment.children.map((item) => 
      <div className={'childrenContainer commentPointer' + checkDarkModeLinks(this.props.darkMode)} key={item.id} onClick={() => this.onChildrenClick(item)}>
        {(item.username !== null ? item.username : 'anon') + item.id}
      </div>
      )
    }
  }

  commentHeader = () => {
    return(
      <div className="commentHeader">
        <div onClick={this.opened}>{this.state.opened ? "[-]" : "[+]"}</div>
        
        <div className={'commentPointer commentUsernameContainer' + checkDarkModeLinks(this.props.darkMode)} onClick={this.reply}>
          {this.props.comment.username ? this.props.comment.username + this.props.comment.id : "anon" + this.props.comment.id}
        </div>

        {this.props.comment.comments_id && <div className="answer">resposta a</div>}

        {this.props.comment.comments_id !== null ? 
          <a href={'#' + this.props.comment.comments_id} className={'answerUsername' + checkDarkModeLinks(this.props.darkMode)}>
            {this.props.comment.parent_username !== null && this.props.comment.parent_username !== undefined ?
              this.props.comment.parent_username + this.props.comment.comments_id 
              : 
              'anon' + this.props.comment.comments_id
            }
          </a> 
          : 
          <div></div>
        }

        <div className="answer"> | </div>
        <div className="selectForbiden commentTime">{moment(this.props.comment.created_at).format('DD-MM-YYYY | HH:mm')}</div>

        {this.state.opened ? 
          <div className="childrenContainer">
            {this.setChildren()}
          </div> 
          : 
          <div className="childrenContainer">
            {(this.props.comment.children !== undefined ? this.props.comment.children.length : 0 ) + ' respostas'}
          </div>
        }

      </div>
    )
  }

  commentFooter = () => {
    return (
      <div className="commentFooter">
        <div className="commentPointer replyButton" onClick={this.reply} >responder</div>
      </div>
    )
  }

  commentContent = () => {
    return (
      <div className="commentContent">
        {this.props.comment.comment}
      </div>
    )
  }

  render() {
    return (
      <div>
        <div id={this.props.comment.id} className={'commentParentContainer' + checkDarkMode(this.props.darkMode, true)}>
          {this.commentHeader()} 
          <div style={{display: this.state.opened ? '' : 'none'}}>
            {this.commentContent()}
            {this.commentFooter()}
          </div>        
          {this.state.child !== null && <Comment comment={this.state.child} commentId={this.state.child.id} id={this.props.id} opened={this.state.opened} />}
        </div>
        {this.state.reply && this.state.opened &&
          <CustomEditor 
            articleId={this.props.id}
            commentType={"reply"}
            commentId={this.props.commentId}
          />
        }
      </div>
    )
  }
}

function mapStateToProps(state) {
  return {
    darkMode: state.view.darkMode,
    currentArticle: state.article.currentArticle
  };
}

function mapDispatchToProps() {
  return { };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(Comment);
