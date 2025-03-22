import React from 'react';
import { Box, Button, TextField, Typography } from '@mui/material';

const Comments = ({ 
  filteredComments, 
  comment, 
  loggedIn, 
  handleCommentChange, 
  handleCommentSubmit 
}) => {
  return (
    <Box>
      <div>
        <h3>Comments</h3>
        {filteredComments.length > 0 ? (
          filteredComments.map((comment) => (
            <Box key={comment.id} sx={{ p: 1, m: 1, border: '1px solid #ccc', borderRadius: '5px' }}>
              <Typography variant="body1">
                <strong>{comment.nickname ? comment.nickname.nickname : "null"}</strong>: {comment.content}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                {new Date(comment.created_at).toLocaleString()}
              </Typography>
            </Box>
          ))
        ) : (
          <Typography sx={{ margin: '1rem 0 1rem 0' }}>아직 댓글이 없습니다.</Typography>
        )}
        {/* 댓글 작성 폼 */}
        <div style={{ display: 'flex' }}>
          <TextField
            variant="outlined"
            fullWidth
            placeholder={loggedIn ? "댓글을 입력하세요" : "로그인 후 이용해주세요"}
            value={comment}
            onChange={handleCommentChange}
            disabled={!loggedIn} // 로그인 여부에 따라 비활성화
            sx={{ margin: '1rem 1rem 0 0' }}
          />
          <Button
            sx={{ margin: '1rem 0 0 0' }}
            variant="contained"
            onClick={handleCommentSubmit}
            disabled={!loggedIn} // 로그인 여부에 따라 버튼 비활성화
          >
            등록
          </Button>
        </div>
      </div>
    </Box>
  );
};

export default Comments;
